import fs from 'fs/promises';
import { getPool } from '../utils/db.mjs';
import sql from 'mssql';
import dotenv from 'dotenv';
import { DateTime } from 'luxon';
dotenv.config();

async function migrate() {
  const raw = await fs.readFile(new URL('../data/schedules.json', import.meta.url), 'utf8');
  const store = JSON.parse(raw);
  const pool = await getPool();

  try {
    for (const id in store.schedules) {
      const s = store.schedules[id];
      // parse datetime: assume ISO in store.datetime; if not, fallback to Tokyo
      let dt;
      try {
        dt = DateTime.fromISO(s.datetime, { zone: 'utc' });
        if (!dt.isValid) throw new Error('invalid');
      } catch (e) {
        dt = DateTime.fromFormat(s.datetime, 'yyyy-LL-dd HH:mm', { zone: 'Asia/Tokyo' });
      }
      const datetimeIso = dt.toUTC().toISO();
      const reminders = Array.isArray(s.reminders) ? s.reminders.join(',') : (s.reminders ?? null);

      const insertSchedule = await pool.request()
        .input('guildId', sql.NVarChar(64), s.guildId ?? '')
        .input('channelId', sql.NVarChar(64), s.channelId ?? null)
        .input('name', sql.NVarChar(255), s.name)
        .input('description', sql.NVarChar(sql.MAX), s.description ?? null)
        .input('datetime', sql.DateTimeOffset, datetimeIso)
        .input('creatorId', sql.NVarChar(64), s.creatorId ?? '')
        .input('location', sql.NVarChar(255), s.location ?? null)
        .input('reminders', sql.NVarChar(255), reminders)
        .query(`INSERT INTO dbo.schedules (guild_id, channel_id, name, description, datetime_iso, creator_id, location, reminders)
                OUTPUT INSERTED.id
                VALUES (@guildId, @channelId, @name, @description, @datetime, @creatorId, @location, @reminders)`);

      const insertedId = insertSchedule.recordset[0].id;

      if (s.attendees && s.attendees.length) {
        for (const userId of s.attendees) {
          await pool.request()
            .input('scheduleId', sql.Int, insertedId)
            .input('userId', sql.NVarChar(64), userId)
            .query('INSERT INTO dbo.attendees (schedule_id, user_id) VALUES (@scheduleId, @userId)');
        }
      }

      if (s.notificationMessages) {
        for (const m of s.notificationMessages) {
          await pool.request()
            .input('scheduleId', sql.Int, insertedId)
            .input('channelId', sql.NVarChar(64), m.channelId)
            .input('messageId', sql.NVarChar(128), m.messageId)
            .input('offset', sql.Int, m.reminderOffsetMinutes ?? 0)
            .input('sentAt', sql.DateTimeOffset, m.sentAt ?? null)
            .query('INSERT INTO dbo.notification_messages (schedule_id, channel_id, message_id, reminder_offset_minutes, sent_at) VALUES (@scheduleId, @channelId, @messageId, @offset, @sentAt)');
        }
      }
    }

    console.log('Migration complete');
  } catch (err) {
    console.error('Migration error:', err);
    process.exitCode = 1;
  } finally {
    try { await (await getPool()).close(); } catch(e) {}
  }
}

migrate();
