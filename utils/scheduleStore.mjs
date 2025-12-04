import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

const DATA_DIR = path.join(process.cwd(), 'data');
const SCHEDULE_FILE = path.join(DATA_DIR, 'schedules.json');

async function ensureFile() {
	try {
		await fs.mkdir(DATA_DIR, { recursive: true });
		try {
			await fs.access(SCHEDULE_FILE);
		} catch (e) {
			await fs.writeFile(SCHEDULE_FILE, '[]', 'utf8');
		}
	} catch (e) {
		// ignore
	}
}

async function readAll() {
	await ensureFile();
	const txt = await fs.readFile(SCHEDULE_FILE, 'utf8');
	try {
		const parsed = JSON.parse(txt || '[]');
		// Support legacy format { nextId: n, schedules: { id: {...}, ... } }
		if (parsed && typeof parsed === 'object' && parsed.schedules && typeof parsed.schedules === 'object') {
			return Object.values(parsed.schedules);
		}
		if (Array.isArray(parsed)) return parsed;
		return [];
	} catch (e) { return []; }
}

async function writeAll(arr) {
	await ensureFile();
	await fs.writeFile(SCHEDULE_FILE, JSON.stringify(arr, null, 2), 'utf8');
}

export async function listSchedules(guildId) {
	const all = await readAll();
	if (guildId) return all.filter(s => s.guildId === String(guildId));
	return all;
}

export async function getSchedule(id) {
	const all = await readAll();
	const sid = String(id || '');
	// Exact match first
	let found = all.find(s => s.id === sid);
	if (found) return found;
	// Allow prefix match for short IDs (e.g., first 8 chars)
	if (sid.length >= 3) {
		found = all.find(s => s.id.startsWith(sid));
		if (found) return found;
	}
	return null;
}

export async function createSchedule({ guildId, title, datetime, description, creatorId }) {
	const all = await readAll();
	const id = randomUUID();
	const schedule = {
		id,
		guildId: String(guildId || ''),
		title: String(title || 'Untitled'),
		description: description || '',
		datetime: new Date(datetime).toISOString(),
		creatorId: String(creatorId || ''),
		attendees: [],
		createdAt: new Date().toISOString(),
	};
	all.push(schedule);
	await writeAll(all);
	return schedule;
}

export async function updateSchedule(id, patch) {
	const all = await readAll();
	const idx = all.findIndex(s => s.id === String(id));
	if (idx === -1) return { ok: false };
	all[idx] = { ...all[idx], ...patch };
	await writeAll(all);
	return { ok: true, schedule: all[idx] };
}

export async function deleteSchedule(id) {
	const all = await readAll();
	const idx = all.findIndex(s => s.id === String(id));
	if (idx === -1) return false;
	all.splice(idx, 1);
	await writeAll(all);
	return true;
}

export async function addAttendance(scheduleId, userId) {
	const all = await readAll();
	const s = all.find(x => x.id === String(scheduleId));
	if (!s) return false;
	if (!s.attendees) s.attendees = [];
	if (!s.attendees.includes(String(userId))) s.attendees.push(String(userId));
	await writeAll(all);
	return true;
}

export async function removeAttendance(scheduleId, userId) {
	const all = await readAll();
	const s = all.find(x => x.id === String(scheduleId));
	if (!s || !s.attendees) return false;
	const idx = s.attendees.indexOf(String(userId));
	if (idx === -1) return false;
	s.attendees.splice(idx, 1);
	await writeAll(all);
	return true;
}

export default { listSchedules, getSchedule, createSchedule, updateSchedule, deleteSchedule, addAttendance, removeAttendance };
