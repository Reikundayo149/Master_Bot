import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { createSchedule, listSchedules, getSchedule, deleteSchedule } from '../utils/scheduleStore.mjs';

export default {
  data: new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('スケジュール管理')
    .addSubcommand(sub => sub.setName('create').setDescription('スケジュールを作成します')
      .addStringOption(o => o.setName('title').setDescription('タイトル').setRequired(true))
      .addStringOption(o => o.setName('datetime').setDescription('日時（ISO or YYYY-MM-DD HH:MM）').setRequired(true))
      .addStringOption(o => o.setName('description').setDescription('詳細')))
    .addSubcommand(sub => sub.setName('list').setDescription('このサーバーのスケジュール一覧を表示します'))
      .addSubcommand(sub => sub.setName('panel').setDescription('管理パネルを開きます（管理者向け）'))
    .addSubcommand(sub => sub.setName('view').setDescription('スケジュールを表示します').addStringOption(o => o.setName('id').setDescription('スケジュールID').setRequired(true)))
    .addSubcommand(sub => sub.setName('delete').setDescription('スケジュールを削除します').addStringOption(o => o.setName('id').setDescription('スケジュールID').setRequired(true))),
  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const safeSend = async (payload) => {
      try {
        if (interaction.deferred) return await interaction.editReply(payload);
        return await interaction.reply(payload);
      } catch (err) {
        console.error('safeSend reply/editReply failed:', err);
        try {
          const text = payload.content || (payload.embeds ? '（埋め込みメッセージ）' : 'メッセージ');
          return await interaction.channel?.send?.(text);
        } catch (chErr) {
          console.error('チャネル送信にも失敗しました:', chErr);
        }
      }
    };

    try { await interaction.deferReply({ flags: 64 }); } catch (e) {}

    try {
      if (sub === 'create') {
        const title = interaction.options.getString('title');
        const datetimeRaw = interaction.options.getString('datetime');
        const desc = interaction.options.getString('description') || '';
        // Try to parse datetime
        let dt = new Date(datetimeRaw);
        if (isNaN(dt.getTime())) {
          // Try replace space with 'T'
          dt = new Date(datetimeRaw.replace(' ', 'T'));
        }
        if (isNaN(dt.getTime())) {
          await safeSend({ content: '無効な日時形式です。ISO または `YYYY-MM-DD HH:MM` の形式で指定してください。', flags: 64 });
          return;
        }
        const schedule = await createSchedule({ guildId: interaction.guildId, title, datetime: dt.toISOString(), description: desc, creatorId: interaction.user.id });
        const embed = new EmbedBuilder()
          .setTitle('✅ スケジュールを作成しました')
          .addFields(
            { name: 'タイトル', value: schedule.title },
            { name: '日時', value: new Date(schedule.datetime).toLocaleString() },
            { name: 'ID', value: schedule.id },
          )
          .setTimestamp();
        await safeSend({ embeds: [embed], flags: 64 });
        return;
      }

      if (sub === 'panel') {
        // Admin panel: show create button and list
        const all = await listSchedules(interaction.guildId);
        const listText = (!all || all.length === 0) ? 'スケジュールは登録されていません。' : all.slice(0,10).map(s => `• ${s.title} — ${new Date(s.datetime).toLocaleString()} (ID: ${s.id})`).join('\n');
        const embed = new EmbedBuilder().setTitle('🧭 スケジュール管理パネル').setDescription(listText).setTimestamp();
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = await import('discord.js');
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId('sched:create').setLabel('スケジュール作成').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId('sched:list').setLabel('一覧を更新').setStyle(ButtonStyle.Secondary),
        );
        await safeSend({ embeds: [embed], components: [row], flags: 64 });
        return;
      }

      if (sub === 'list') {
        const all = await listSchedules(interaction.guildId);
        if (!all || all.length === 0) {
          await safeSend({ content: 'このサーバーのスケジュールはありません。', flags: 64 });
          return;
        }
          const lines = all.slice(0, 10).map(s => `• **${s.title}** — ${new Date(s.datetime).toLocaleString()} (ID: ${s.id})`);
        const embed = new EmbedBuilder().setTitle('📅 スケジュール一覧').setDescription(lines.join('\n'));
        await safeSend({ embeds: [embed], flags: 64 });
        return;
      }

      if (sub === 'view') {
        const id = interaction.options.getString('id');
        const s = await getSchedule(id);
        if (!s || s.guildId !== interaction.guildId) {
          await safeSend({ content: 'スケジュールが見つかりません。', flags: 64 });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle(s.title)
          .setDescription(s.description || '説明なし')
          .addFields(
            { name: '日時', value: new Date(s.datetime).toLocaleString(), inline: true },
            { name: '作成者ID', value: s.creatorId || '不明', inline: true },
            { name: '参加者数', value: `${(s.attendees || []).length}`, inline: true },
            { name: 'ID', value: s.id, inline: false },
          )
          .setTimestamp(new Date(s.createdAt || s.datetime));
        await safeSend({ embeds: [embed], flags: 64 });
        return;
      }

      if (sub === 'delete') {
        const id = interaction.options.getString('id');
        const s = await getSchedule(id);
        if (!s || s.guildId !== interaction.guildId) {
          await safeSend({ content: 'スケジュールが見つかりません。', flags: 64 });
          return;
        }
        const ok = await deleteSchedule(id);
        if (ok) {
          await safeSend({ content: '✅ スケジュールを削除しました。', flags: 64 });
        } else {
          await safeSend({ content: '❌ スケジュールの削除に失敗しました。', flags: 64 });
        }
        return;
      }
    } catch (err) {
      console.error('schedule command error:', err);
      await safeSend({ content: 'コマンド実行中にエラーが発生しました。', flags: 64 });
    }
  }
};
