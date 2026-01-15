import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
// Allow overriding the schedules file path via env var so hosts can mount persistent storage.
const SCHEDULE_FILE = process.env.SCHEDULES_FILE || path.join(DATA_DIR, 'schedules.json');

async function ensureFile() {
	try {
		const dir = path.dirname(SCHEDULE_FILE);
		await fs.mkdir(dir, { recursive: true });
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
	const tmp = `${SCHEDULE_FILE}.tmp`;
	const bak = `${SCHEDULE_FILE}.bak`;
	const payload = JSON.stringify(arr, null, 2);
	// create a backup of existing file if present
	try {
		if (fsSync.existsSync(SCHEDULE_FILE)) {
			await fs.copyFile(SCHEDULE_FILE, bak);
		}
	} catch (e) {
		// ignore backup errors
		console.warn('scheduleStore: backup failed', e);
	}
	// write atomically: write tmp then rename
	await fs.writeFile(tmp, payload, 'utf8');
	await fs.rename(tmp, SCHEDULE_FILE);
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

export async function createSchedule({ guildId, title, datetime, description, creatorId, notionPageId, lastSyncTime }) {
	const all = await readAll();
	const dt = new Date(datetime);
	// Format date as YYYYMMDD
	const year = String(dt.getFullYear());
	const month = String(dt.getMonth() + 1).padStart(2, '0');
	const day = String(dt.getDate()).padStart(2, '0');
	const dateStr = `${year}${month}${day}`;
	
	// Count schedules with the same date
	const sameDateCount = all.filter(s => s.id.startsWith(dateStr)).length;
	const id = sameDateCount === 0 ? dateStr : `${dateStr}_${sameDateCount + 1}`;
	
	const schedule = {
		id,
		guildId: String(guildId || ''),
		title: String(title || 'Untitled'),
		description: description || '',
		datetime: dt.toISOString(),
		creatorId: String(creatorId || ''),
		attendees: [],
		createdAt: new Date().toISOString(),
		notionPageId: notionPageId || null,
		lastSyncTime: lastSyncTime || null,
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
