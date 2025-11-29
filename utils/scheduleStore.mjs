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
