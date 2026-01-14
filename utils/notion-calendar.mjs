import { Client } from '@notionhq/client';
import dotenv from 'dotenv';

dotenv.config();

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const DATABASE_ID = process.env.NOTION_DATABASE_ID;

/**
 * Notion Database にスケジュールを作成
 * @param {Object} scheduleData - スケジュールデータ
 * @returns {Promise<Object>} 作成されたページ
 */
export async function createEventInNotion(scheduleData) {
  try {
    const { title, datetime, description, guildId, creatorId } = scheduleData;

    const response = await notion.pages.create({
      parent: {
        database_id: DATABASE_ID,
      },
      properties: {
        名前: {
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        },
        Date: {
          date: {
            start: new Date(datetime).toISOString(),
          },
        },
        Description: {
          rich_text: [
            {
              text: {
                content: description || '',
              },
            },
          ],
        },
        Guild_ID: {
          rich_text: [
            {
              text: {
                content: guildId,
              },
            },
          ],
        },
        Creator_ID: {
          rich_text: [
            {
              text: {
                content: creatorId,
              },
            },
          ],
        },
      },
    });

    console.log('✅ Notion にスケジュールを作成しました:', response.id);
    return response;
  } catch (error) {
    console.error('❌ Notion スケジュール作成エラー:', error);
    throw error;
  }
}

/**
 * Notion Database からスケジュールを一覧取得
 * @param {String} guildId - ギルドID
 * @returns {Promise<Array>} スケジュール一覧
 */
export async function listEventsFromNotion(guildId) {
  try {
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
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

    const schedules = response.results.map((page) => {
      const props = page.properties;
      return {
        id: page.id,
        title: props.名前?.title?.[0]?.plain_text || 'No title',
        datetime: props.Date?.date?.start || null,
        description: props.Description?.rich_text?.[0]?.plain_text || '',
        guildId: props.Guild_ID?.rich_text?.[0]?.plain_text || '',
        creatorId: props.Creator_ID?.rich_text?.[0]?.plain_text || '',
      };
    });

    console.log(`✅ Notion から ${schedules.length} 件のスケジュールを取得しました`);
    return schedules;
  } catch (error) {
    console.error('❌ Notion スケジュール一覧取得エラー:', error);
    throw error;
  }
}

/**
 * Notion Database からスケジュールを削除
 * @param {String} pageId - Notion ページID
 * @returns {Promise<void>}
 */
export async function deleteEventFromNotion(pageId) {
  try {
    await notion.pages.update({
      page_id: pageId,
      archived: true,
    });

    console.log('✅ Notion からスケジュールを削除しました:', pageId);
  } catch (error) {
    console.error('❌ Notion スケジュール削除エラー:', error);
    throw error;
  }
}

/**
 * Notion Database からスケジュールを検索
 * @param {String} guildId - ギルドID
 * @param {String} title - スケジュールタイトル
 * @returns {Promise<Object|null>} マッチしたスケジュール
 */
export async function findEventInNotion(guildId, title) {
  try {
    const schedules = await listEventsFromNotion(guildId);
    const found = schedules.find(
      (s) => s.title.toLowerCase() === title.toLowerCase()
    );
    return found || null;
  } catch (error) {
    console.error('❌ Notion スケジュール検索エラー:', error);
    throw error;
  }
}

export default {
  createEventInNotion,
  listEventsFromNotion,
  deleteEventFromNotion,
  findEventInNotion,
};
