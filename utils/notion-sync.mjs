import { Client } from '@notionhq/client';
import dotenv from 'dotenv';
import { createSchedule, listSchedules, getSchedule, deleteSchedule, updateSchedule } from './scheduleStore.mjs';

dotenv.config();

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
  notionVersion: '2022-06-28', // 現在のAPIバージョン（後で2025-09-03に移行可能）
});

const SCHEDULE_DATABASE_ID = process.env.NOTION_SCHEDULE_DATABASE_ID;
const SYNC_INTERVAL = (process.env.NOTION_SYNC_INTERVAL || 30) * 1000; // 環境変数から秒単位で取得し、ミリ秒に変換

let syncTimer = null;
let lastSyncTime = new Date();
let isFirstSync = true;

/**
 * Notionからスケジュールを取得して、ローカルDBと同期
 * @param {String} guildId - ギルドID
 * @param {Object} client - Discord Client（通知用）
 */
export async function syncNotionToDiscord(guildId, discordClient) {
  try {
    console.log('🔄 Notion → Discord 同期開始...');

    // Notionから最新のスケジュールを取得
    const notionEvents = await fetchNotionEvents(guildId);
    
    // ローカルDBのスケジュールを取得
    const localSchedules = await listSchedules(guildId);

    // Notionのイベントをローカルに反映
    for (const notionEvent of notionEvents) {
      const localSchedule = localSchedules.find(s => s.notionPageId === notionEvent.id);

      if (!localSchedule) {
        // 新規作成: Notionにあってローカルにない
        await handleNewNotionEvent(notionEvent, guildId, discordClient);
      } else {
        // 更新チェック: last_edited_timeを比較
        const notionEditTime = new Date(notionEvent.last_edited_time);
        const localEditTime = localSchedule.lastSyncTime ? new Date(localSchedule.lastSyncTime) : new Date(0);
        
        if (notionEditTime > localEditTime) {
          await handleUpdatedNotionEvent(notionEvent, localSchedule, guildId, discordClient);
        }
      }
    }

    // 削除検知: ローカルにあってNotionにない
    const notionIds = notionEvents.map(e => e.id);
    for (const localSchedule of localSchedules) {
      if (localSchedule.notionPageId && !notionIds.includes(localSchedule.notionPageId)) {
        await handleDeletedNotionEvent(localSchedule, guildId, discordClient);
      }
    }

    lastSyncTime = new Date();
    isFirstSync = false;
    console.log('✅ Notion → Discord 同期完了');
  } catch (error) {
    console.error('❌ Notion同期エラー:', error);
  }
}

/**
 * Notionデータベースからイベントを取得
 */
async function fetchNotionEvents(guildId) {
  try {
    const response = await notion.databases.query({
      database_id: SCHEDULE_DATABASE_ID,
      filter: {
        property: 'Guild_ID',
        rich_text: {
          equals: guildId,
        },
      },
      sorts: [
        {
          property: 'Date',
          direction: 'ascending',
        },
      ],
    });

    return response.results.map((page) => {
      const props = page.properties;
      return {
        id: page.id,
        title: props.名前?.title?.[0]?.plain_text || 'No title',
        datetime: props.Date?.date?.start || null,
        description: props.Description?.rich_text?.[0]?.plain_text || '',
        guildId: props.Guild_ID?.rich_text?.[0]?.plain_text || '',
        creatorId: props.Creator_ID?.rich_text?.[0]?.plain_text || '',
        last_edited_time: page.last_edited_time,
      };
    });
  } catch (error) {
    console.error('❌ Notionイベント取得エラー:', error);
    return [];
  }
}

/**
 * Notionで新規作成されたイベントをローカルに追加
 */
async function handleNewNotionEvent(notionEvent, guildId, discordClient) {
  try {
    // 初回同期時は通知しない（既存データの同期なので）
    if (isFirstSync) {
      console.log(`📝 [初回同期] Notionイベントをインポート: ${notionEvent.title}`);
      await createSchedule({
        guildId,
        title: notionEvent.title,
        datetime: notionEvent.datetime,
        description: notionEvent.description,
        creatorId: notionEvent.creatorId || 'notion',
        notionPageId: notionEvent.id,
        lastSyncTime: notionEvent.last_edited_time,
      });
      return;
    }

    console.log(`✨ [新規] Notionで新しいスケジュールが作成されました: ${notionEvent.title}`);
    
    await createSchedule({
      guildId,
      title: notionEvent.title,
      datetime: notionEvent.datetime,
      description: notionEvent.description,
      creatorId: notionEvent.creatorId || 'notion',
      notionPageId: notionEvent.id,
      lastSyncTime: notionEvent.last_edited_time,
    });

    // Discordで通知
    await sendNotificationToGuild(discordClient, guildId, {
      title: '📅 新しいスケジュールが追加されました',
      description: `**${notionEvent.title}**\n日時: ${new Date(notionEvent.datetime).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}${notionEvent.description ? `\n詳細: ${notionEvent.description}` : ''}`,
      color: 0x00ff00,
    });
  } catch (error) {
    console.error('❌ 新規Notionイベント処理エラー:', error);
  }
}

/**
 * Notionで更新されたイベントをローカルに反映
 */
async function handleUpdatedNotionEvent(notionEvent, localSchedule, guildId, discordClient) {
  try {
    console.log(`🔄 [更新] Notionでスケジュールが更新されました: ${notionEvent.title}`);
    
    await updateSchedule(localSchedule.id, {
      title: notionEvent.title,
      datetime: notionEvent.datetime,
      description: notionEvent.description,
      lastSyncTime: notionEvent.last_edited_time,
    });

    // Discordで通知
    await sendNotificationToGuild(discordClient, guildId, {
      title: '📝 スケジュールが更新されました',
      description: `**${notionEvent.title}**\n日時: ${new Date(notionEvent.datetime).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}${notionEvent.description ? `\n詳細: ${notionEvent.description}` : ''}`,
      color: 0xffa500,
    });
  } catch (error) {
    console.error('❌ Notionイベント更新エラー:', error);
  }
}

/**
 * Notionで削除されたイベントをローカルからも削除
 */
async function handleDeletedNotionEvent(localSchedule, guildId, discordClient) {
  try {
    console.log(`🗑️ [削除] Notionでスケジュールが削除されました: ${localSchedule.title}`);
    
    await deleteSchedule(localSchedule.id);

    // Discordで通知
    await sendNotificationToGuild(discordClient, guildId, {
      title: '🗑️ スケジュールが削除されました',
      description: `**${localSchedule.title}**`,
      color: 0xff0000,
    });
  } catch (error) {
    console.error('❌ Notionイベント削除エラー:', error);
  }
}

/**
 * Discordギルドに通知を送信
 */
async function sendNotificationToGuild(discordClient, guildId, embed) {
  try {
    const guild = discordClient.guilds.cache.get(guildId);
    if (!guild) return;

    // システムチャンネルまたは最初のテキストチャンネルに送信
    const channel = guild.systemChannel || guild.channels.cache.find(ch => ch.isTextBased() && ch.permissionsFor(guild.members.me).has('SendMessages'));
    
    if (!channel) {
      console.log('通知チャンネルが見つかりませんでした');
      return;
    }

    const { EmbedBuilder } = await import('discord.js');
    const embedMsg = new EmbedBuilder()
      .setTitle(embed.title)
      .setDescription(embed.description)
      .setColor(embed.color)
      .setTimestamp();

    await channel.send({ embeds: [embedMsg] });
  } catch (error) {
    console.error('❌ Discord通知エラー:', error);
  }
}

/**
 * 自動同期を開始
 */
export function startNotionSync(discordClient) {
  if (syncTimer) {
    console.log('⚠️ Notion同期は既に開始されています');
    return;
  }

  console.log(`🚀 Notion自動同期を開始します（${SYNC_INTERVAL / 1000}秒間隔）`);
  
  // すぐに初回同期を実行
  performSyncForAllGuilds(discordClient);

  // 定期実行
  syncTimer = setInterval(() => {
    performSyncForAllGuilds(discordClient);
  }, SYNC_INTERVAL);
}

/**
 * 自動同期を停止
 */
export function stopNotionSync() {
  if (syncTimer) {
    clearInterval(syncTimer);
    syncTimer = null;
    console.log('⏹️ Notion自動同期を停止しました');
  }
}

/**
 * すべてのギルドで同期を実行
 */
async function performSyncForAllGuilds(discordClient) {
  try {
    const guilds = discordClient.guilds.cache;
    
    for (const [guildId, guild] of guilds) {
      await syncNotionToDiscord(guildId, discordClient);
    }
  } catch (error) {
    console.error('❌ ギルド同期エラー:', error);
  }
}

export default {
  syncNotionToDiscord,
  startNotionSync,
  stopNotionSync,
};
