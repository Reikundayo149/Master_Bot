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
import fs from 'fs/promises';
import path from 'path';

const DATA_PATH = path.resolve('data', 'schedules.json');

async function read() {
  try {
    const txt = await fs.readFile(DATA_PATH, 'utf8');
    return JSON.parse(txt);
  } catch (err) {
    if (err.code === 'ENOENT') {
      const init = { nextId: 1, schedules: {} };
      await write(init);
      return init;
    }
    throw err;
  }
}

async function write(obj) {
  await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
  await fs.writeFile(DATA_PATH, JSON.stringify(obj, null, 2), 'utf8');
}

export async function listSchedules() {
  const db = await read();
  return Object.values(db.schedules).sort((a, b) => a.id - b.id);
}

export async function getSchedule(id) {
  const db = await read();
  return db.schedules[String(id)] || null;
}

export async function createSchedule({ name, datetime, description, creatorId, guildId, reminders, channelId, location }) {
  const db = await read();
  const id = db.nextId++;
  const obj = {
    id,
    name,
    datetime, // expected to be ISO string
    description: description || '',
    creatorId: String(creatorId),
    guildId: guildId ? String(guildId) : null,
    channelId: channelId ? String(channelId) : null,
    location: location || '',
    attendees: [],
    reminders: Array.isArray(reminders) ? reminders : [60, 10], // minutes before
    notifiedReminders: []
  };
  db.schedules[String(id)] = obj;
  await write(db);
  return obj;
}

export async function addNotificationMessage(scheduleId, channelId, messageId) {
  const db = await read();
  const s = db.schedules[String(scheduleId)];
  if (!s) return { ok: false, reason: 'not_found' };
  s.notificationMessages = s.notificationMessages || [];
  s.notificationMessages.push({ channelId: String(channelId), messageId: String(messageId) });
  await write(db);
  return { ok: true };
}

export async function getNotificationMessages(scheduleId) {
  const db = await read();
  const s = db.schedules[String(scheduleId)];
  if (!s) return [];
  return s.notificationMessages || [];
}

export async function updateSchedule(scheduleId, updates) {
  const db = await read();
  const s = db.schedules[String(scheduleId)];
  if (!s) return { ok: false, reason: 'not_found' };
  // allow updates to name, datetime, description, channelId, reminders, location
  if (updates.name !== undefined) s.name = updates.name;
  if (updates.datetime !== undefined) s.datetime = updates.datetime;
  if (updates.description !== undefined) s.description = updates.description;
  if (updates.channelId !== undefined) s.channelId = updates.channelId ? String(updates.channelId) : null;
  if (updates.reminders !== undefined) s.reminders = Array.isArray(updates.reminders) ? updates.reminders : s.reminders;
  if (updates.location !== undefined) s.location = updates.location;
  await write(db);
  return { ok: true, schedule: s };
}

export async function deleteSchedule(id) {
  const db = await read();
  if (!db.schedules[String(id)]) return false;
  delete db.schedules[String(id)];
  await write(db);
  return true;
}

export async function addAttendance(scheduleId, userId) {
  const db = await read();
  const s = db.schedules[String(scheduleId)];
  if (!s) return { ok: false, reason: 'not_found' };
  const uid = String(userId);
  if (!s.attendees.includes(uid)) s.attendees.push(uid);
  await write(db);
  return { ok: true };
}

export async function removeAttendance(scheduleId, userId) {
  const db = await read();
  const s = db.schedules[String(scheduleId)];
  if (!s) return { ok: false, reason: 'not_found' };
  const uid = String(userId);
  s.attendees = s.attendees.filter(x => x !== uid);
  await write(db);
  return { ok: true };
}

export async function markNotified(scheduleId, reminderMinutes) {
  const db = await read();
  const s = db.schedules[String(scheduleId)];
  if (!s) return { ok: false, reason: 'not_found' };
  s.notifiedReminders = s.notifiedReminders || [];
  if (!s.notifiedReminders.includes(reminderMinutes)) s.notifiedReminders.push(reminderMinutes);
  await write(db);
  return { ok: true };
}
