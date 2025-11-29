import { listSchedules, markNotified, addNotificationMessage } from './scheduleStore.mjs';
import { DateTime } from 'luxon';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

let _interval = null;
let _retryTimeout = null;
let _failureCount = 0;

const DEFAULT_BACKOFF_START = 30; // seconds
const DEFAULT_BACKOFF_MAX = 300; // seconds (5 minutes)

export function startReminders(client, options = {}) {
  const checkInterval = options.checkIntervalSeconds || 60;
  if (_retryTimeout) {
    clearTimeout(_retryTimeout);
    _retryTimeout = null;
  }
  if (_interval) clearInterval(_interval);
  _failureCount = 0;
  _interval = setInterval(async () => {
    try {
      const schedules = await listSchedules();
      const now = DateTime.utc();
      for (const s of schedules) {
        if (!s.datetime) continue;
        const dt = DateTime.fromISO(s.datetime, { zone: 'utc' });
        if (!dt.isValid) continue;
        const minutesUntil = Math.round(dt.diff(now, 'minutes').minutes);
        if (minutesUntil < 0) continue; // past
        for (const rem of (s.reminders || [])) {
          // already notified?
          if (s.notifiedReminders && s.notifiedReminders.includes(rem)) continue;
          if (minutesUntil <= rem) {
            // send notification to guild channel
            try {
              if (!s.guildId) continue;
              const guild = client.guilds.cache.get(String(s.guildId));
              if (!guild) continue;
              // prefer system channel, else find first writable text channel
              let channel = guild.systemChannel;
              if (!channel) {
                channel = guild.channels.cache.find(c => c.isTextBased && c.permissionsFor && c.permissionsFor(client.user).has('SendMessages'));
              }
              if (!channel) continue;
              const attendees = s.attendees || [];
              const mention = attendees.slice(0, 25).map(id => `<@${id}>`).join(' ');
              const more = attendees.length > 25 ? `and ${attendees.length - 25} more` : '';
              const embed = new EmbedBuilder()
                .setTitle(`⏰ リマインダー: ${s.name}`)
                .setDescription(`${s.description || '説明なし'}`)
                .addFields(
                  { name: '日時', value: DateTime.fromISO(s.datetime, { zone: 'utc' }).setZone('Asia/Tokyo').toFormat("yyyy-LL-dd HH:mm '(JST)'") || s.datetime, inline: true },
                  { name: '参加数', value: String(attendees.length), inline: true },
                  { name: 'リマインド', value: `${rem} 分前`, inline: true },
                  { name: '場所', value: s.location || '未指定', inline: true }
                )
                .setFooter({ text: '出欠ボタンで簡単に参加登録できます' })
                .setColor(0xFAA61A)
                .setTimestamp();

              const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`sched:${s.id}:join`).setLabel('参加する').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`sched:${s.id}:leave`).setLabel('不参加').setStyle(ButtonStyle.Secondary)
              );

              const sent = await channel.send({ embeds: [embed], components: [row] });
              // persist message id so we can update embed later
              try {
                await addNotificationMessage(s.id, channel.id, sent.id);
              } catch (err) {
                console.error('Failed to record notification message', err);
              }
              // persist that this reminder offset was sent
              try {
                await markNotified(s.id, rem);
              } catch (err) {
                console.error('Failed to mark reminder notified', err);
              }
            } catch (err) {
              console.error('Reminder send failed', err);
            }
          }
        }
      }
    } catch (err) {
      console.error('Reminder loop error', err);
      // On connection/login errors, back off and retry after exponential delay
      tryHandleReminderFailure(client, options, err);
    }
  }, checkInterval * 1000);
}

export function stopReminders() {
  if (_interval) clearInterval(_interval);
  if (_retryTimeout) clearTimeout(_retryTimeout);
}

function tryHandleReminderFailure(client, options, err) {
  // If it's not a connection/login error, just log and continue (will retry next interval)
  const isConnError = (err && (err.code === 'ELOGIN' || String(err).includes('Client with IP address') || String(err).includes('Cannot open server')));
  if (!isConnError) return;

  _failureCount = Math.min(20, _failureCount + 1);
  const start = options.backoffStartSeconds || DEFAULT_BACKOFF_START;
  const max = options.backoffMaxSeconds || DEFAULT_BACKOFF_MAX;
  const backoff = Math.min(max, start * Math.pow(2, _failureCount - 1));

  console.warn(`Reminder loop detected DB connection error. Pausing reminders for ${backoff} seconds (failure #${_failureCount}).`);

  // stop the interval loop
  if (_interval) {
    clearInterval(_interval);
    _interval = null;
  }

  // schedule a retry
  if (_retryTimeout) clearTimeout(_retryTimeout);
  _retryTimeout = setTimeout(() => {
    console.log('Retrying reminder loop after backoff...');
    _retryTimeout = null;
    try {
      startReminders(client, options);
    } catch (e) {
      console.error('Failed to restart reminder loop', e);
    }
  }, backoff * 1000);
}

export async function updateNotificationEmbeds(client, scheduleId) {
  try {
    const ss = await import('./scheduleStore.mjs');
    const { getSchedule, getNotificationMessages } = ss;
    const s = await getSchedule(scheduleId);
    if (!s) return;
    const msgs = await getNotificationMessages(scheduleId);
    for (const m of msgs) {
      try {
        const ch = await client.channels.fetch(m.channelId).catch(() => null);
        if (!ch || !ch.isTextBased()) continue;
        const msg = await ch.messages.fetch(m.messageId).catch(() => null);
        if (!msg) continue;
        const attendees = s.attendees || [];
        const mention = attendees.slice(0, 25).map(id => `<@${id}>`).join(' ');
        const more = attendees.length > 25 ? `and ${attendees.length - 25} more` : '';
        const embed = new EmbedBuilder()
          .setTitle(`⏰ リマインダー: ${s.name}`)
          .setDescription(`${s.description || '説明なし'}`)
          .addFields(
            { name: '日時', value: DateTime.fromISO(s.datetime, { zone: 'utc' }).setZone('Asia/Tokyo').toFormat("yyyy-LL-dd HH:mm '(JST)'") || s.datetime, inline: true },
            { name: '参加数', value: String(attendees.length), inline: true },
            { name: '場所', value: s.location || '未指定', inline: true }
          )
          .setFooter({ text: '出欠ボタンで簡単に参加登録できます' })
          .setColor(0xFAA61A)
          .setTimestamp();
        await msg.edit({ embeds: [embed] });
      } catch (err) {
        console.error('Failed to update notification message', err);
      }
    }
  } catch (err) {
    console.error('updateNotificationEmbeds error', err);
  }
}

export async function sendNotificationNow(client, scheduleId, rem = 0) {
  try {
    const ss = await import('./scheduleStore.mjs');
    const { getSchedule, addNotificationMessage, markNotified } = ss;
    const s = await getSchedule(scheduleId);
    if (!s) return { ok: false, reason: 'not_found' };
    if (!s.guildId) return { ok: false, reason: 'no_guild' };
    const guild = client.guilds.cache.get(String(s.guildId));
    if (!guild) return { ok: false, reason: 'guild_not_cached' };
    let channel = null;
    if (s.channelId) {
      channel = await guild.channels.fetch(s.channelId).catch(() => null);
    }
    if (!channel) channel = guild.systemChannel;
    if (!channel) {
      channel = guild.channels.cache.find(c => c.isTextBased && c.permissionsFor && c.permissionsFor(client.user).has('SendMessages'));
    }
    if (!channel) return { ok: false, reason: 'no_channel' };

    const attendees = s.attendees || [];
    const mention = attendees.slice(0, 25).map(id => `<@${id}>`).join(' ');
    const more = attendees.length > 25 ? `and ${attendees.length - 25} more` : '';
    const embed = new (await import('discord.js')).EmbedBuilder()
      .setTitle(`⏰ リマインダー: ${s.name}`)
      .setDescription(`${s.description || '説明なし'}`)
      .addFields(
        { name: '日時', value: (await import('luxon')).DateTime.fromISO(s.datetime, { zone: 'utc' }).setZone('Asia/Tokyo').toFormat("yyyy-LL-dd HH:mm '(JST)'") || s.datetime, inline: true },
        { name: '参加数', value: String(attendees.length), inline: true },
        { name: 'リマインド', value: `${rem} 分前`, inline: true },
        { name: '場所', value: s.location || '未指定', inline: true }
      )
      .setFooter({ text: '出欠ボタンで簡単に参加登録できます' })
      .setColor(0xFAA61A)
      .setTimestamp();

    const ActionRowBuilder = (await import('discord.js')).ActionRowBuilder;
    const ButtonBuilder = (await import('discord.js')).ButtonBuilder;
    const ButtonStyle = (await import('discord.js')).ButtonStyle;
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`sched:${s.id}:join`).setLabel('参加する').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`sched:${s.id}:leave`).setLabel('不参加').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`sched:${s.id}:view`).setLabel('参加者を見る').setStyle(ButtonStyle.Primary)
    );

    const sent = await channel.send({ embeds: [embed], components: [row] });
    try {
      await addNotificationMessage(s.id, channel.id, sent.id);
    } catch (err) {
      console.error('Failed to record notification message', err);
    }
    try {
      await markNotified(s.id, rem);
    } catch (err) {
      console.error('Failed to mark notified', err);
    }
    return { ok: true };
  } catch (err) {
    console.error('sendNotificationNow error', err);
    return { ok: false, reason: 'error' };
  }
}
