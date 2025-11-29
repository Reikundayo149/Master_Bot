import { getPool } from './db.mjs';
import { DateTime } from 'luxon';

async function query(queryText, inputs = []) {
  const pool = await getPool();
  const req = pool.request();
  for (const inp of inputs) {
    req.input(inp.name, inp.type, inp.value);
  }
  return req.query(queryText);
}

export async function listSchedules() {
  const pool = await getPool();
  const res = await pool.request().query('SELECT * FROM dbo.schedules ORDER BY datetime_iso');
  const rows = res.recordset;
  // attach attendees and notification messages
  for (const r of rows) {
    const att = await pool.request().input('sid', r.id).query('SELECT user_id FROM dbo.attendees WHERE schedule_id = @sid');
    r.attendees = att.recordset.map(x => x.user_id);
    const msgs = await pool.request().input('sid', r.id).query('SELECT channel_id, message_id, reminder_offset_minutes, sent_at FROM dbo.notification_messages WHERE schedule_id = @sid');
    r.notificationMessages = msgs.recordset;
    // parse reminders CSV
    r.reminders = r.reminders ? String(r.reminders).split(',').map(x => parseInt(x, 10)).filter(n => !isNaN(n)) : [60,10];
    r.notifiedReminders = (await pool.request().input('sid', r.id).query('SELECT offset_minutes FROM dbo.notified_offsets WHERE schedule_id = @sid')).recordset.map(x => x.offset_minutes);
  }
  return rows;
}

export async function getSchedule(id) {
  const pool = await getPool();
  const res = await pool.request().input('id', id).query('SELECT * FROM dbo.schedules WHERE id = @id');
  const r = res.recordset[0];
  if (!r) return null;
  const att = await pool.request().input('sid', r.id).query('SELECT user_id FROM dbo.attendees WHERE schedule_id = @sid');
  r.attendees = att.recordset.map(x => x.user_id);
  const msgs = await pool.request().input('sid', r.id).query('SELECT channel_id, message_id, reminder_offset_minutes, sent_at FROM dbo.notification_messages WHERE schedule_id = @sid');
  r.notificationMessages = msgs.recordset;
  r.reminders = r.reminders ? String(r.reminders).split(',').map(x => parseInt(x, 10)).filter(n => !isNaN(n)) : [60,10];
  r.notifiedReminders = (await pool.request().input('sid', r.id).query('SELECT offset_minutes FROM dbo.notified_offsets WHERE schedule_id = @sid')).recordset.map(x => x.offset_minutes);
  return r;
}

export async function createSchedule({ name, datetime, description, creatorId, guildId, reminders, channelId, location }) {
  const pool = await getPool();
  const dt = DateTime.fromISO(datetime, { zone: 'utc' }).toISO();
  const remindersStr = Array.isArray(reminders) ? reminders.join(',') : (reminders || '60,10');
  const res = await pool.request()
    .input('guildId', 'NVarChar', guildId ?? '')
    .input('channelId', 'NVarChar', channelId ?? null)
    .input('name', 'NVarChar', name)
    .input('description', 'NVarChar', description ?? null)
    .input('datetime', 'DateTimeOffset', dt)
    .input('creatorId', 'NVarChar', String(creatorId))
    .input('location', 'NVarChar', location ?? null)
    .input('reminders', 'NVarChar', remindersStr)
    .query(`INSERT INTO dbo.schedules (guild_id, channel_id, name, description, datetime_iso, creator_id, location, reminders)
            OUTPUT INSERTED.*
            VALUES (@guildId, @channelId, @name, @description, @datetime, @creatorId, @location, @reminders)`);
  const r = res.recordset[0];
  r.attendees = [];
  r.notificationMessages = [];
  r.reminders = remindersStr.split(',').map(x => parseInt(x, 10));
  r.notifiedReminders = [];
  return r;
}

export async function updateSchedule(scheduleId, updates) {
  const pool = await getPool();
  const fields = [];
  const params = {};
  if (updates.name !== undefined) { fields.push('name = @name'); params.name = updates.name; }
  if (updates.datetime !== undefined) { fields.push('datetime_iso = @datetime'); params.datetime = DateTime.fromISO(updates.datetime, { zone: 'utc' }).toISO(); }
  if (updates.description !== undefined) { fields.push('description = @description'); params.description = updates.description; }
  if (updates.channelId !== undefined) { fields.push('channel_id = @channelId'); params.channelId = updates.channelId; }
  if (updates.reminders !== undefined) { fields.push('reminders = @reminders'); params.reminders = Array.isArray(updates.reminders) ? updates.reminders.join(',') : updates.reminders; }
  if (updates.location !== undefined) { fields.push('location = @location'); params.location = updates.location; }
  if (fields.length === 0) return { ok: false, reason: 'no_changes' };
  const q = `UPDATE dbo.schedules SET ${fields.join(', ')}, updated_at = SYSUTCDATETIME() WHERE id = @id`;
  const req = pool.request().input('id', scheduleId);
  for (const k in params) req.input(k, params[k]);
  await req.query(q);
  return { ok: true, schedule: await getSchedule(scheduleId) };
}

export async function deleteSchedule(id) {
  const pool = await getPool();
  await pool.request().input('id', id).query('DELETE FROM dbo.schedules WHERE id = @id');
  return true;
}

export async function addNotificationMessage(scheduleId, channelId, messageId, offsetMinutes = 0) {
  const pool = await getPool();
  await pool.request()
    .input('scheduleId', scheduleId)
    .input('channelId', String(channelId))
    .input('messageId', String(messageId))
    .input('offset', offsetMinutes)
    .query('INSERT INTO dbo.notification_messages (schedule_id, channel_id, message_id, reminder_offset_minutes) VALUES (@scheduleId, @channelId, @messageId, @offset)');
  return { ok: true };
}

export async function getNotificationMessages(scheduleId) {
  const pool = await getPool();
  const res = await pool.request().input('sid', scheduleId).query('SELECT channel_id as channelId, message_id as messageId, reminder_offset_minutes as reminderOffsetMinutes, sent_at as sentAt FROM dbo.notification_messages WHERE schedule_id = @sid');
  return res.recordset;
}

export async function addAttendance(scheduleId, userId) {
  const pool = await getPool();
  await pool.request().input('sid', scheduleId).input('userId', String(userId)).query('IF NOT EXISTS (SELECT 1 FROM dbo.attendees WHERE schedule_id=@sid AND user_id=@userId) INSERT INTO dbo.attendees (schedule_id, user_id) VALUES (@sid, @userId)');
  return { ok: true };
}

export async function removeAttendance(scheduleId, userId) {
  const pool = await getPool();
  await pool.request().input('sid', scheduleId).input('userId', String(userId)).query('DELETE FROM dbo.attendees WHERE schedule_id=@sid AND user_id=@userId');
  return { ok: true };
}

export async function markNotified(scheduleId, reminderMinutes) {
  const pool = await getPool();
  await pool.request().input('sid', scheduleId).input('offset', reminderMinutes).query('IF NOT EXISTS (SELECT 1 FROM dbo.notified_offsets WHERE schedule_id=@sid AND offset_minutes=@offset) INSERT INTO dbo.notified_offsets (schedule_id, offset_minutes) VALUES (@sid, @offset)');
  return { ok: true };
}

export default { listSchedules, getSchedule, createSchedule, updateSchedule, deleteSchedule, addNotificationMessage, getNotificationMessages, addAttendance, removeAttendance, markNotified };
