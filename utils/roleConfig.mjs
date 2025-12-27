import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = process.env.ROLE_CONFIG_FILE || path.join(DATA_DIR, 'roleConfig.json');

async function ensureFile() {
	try {
		const dir = path.dirname(CONFIG_FILE);
		await fs.mkdir(dir, { recursive: true });
		try {
			await fs.access(CONFIG_FILE);
		} catch (e) {
			await fs.writeFile(CONFIG_FILE, JSON.stringify({}, 'utf8'));
		}
	} catch (e) {
		// ignore
	}
}

async function readConfig() {
	await ensureFile();
	const txt = await fs.readFile(CONFIG_FILE, 'utf8');
	try {
		const parsed = JSON.parse(txt || '{}');
		return parsed || {};
	} catch (e) {
		return {};
	}
}

async function writeConfig(config) {
	await ensureFile();
	const tmp = `${CONFIG_FILE}.tmp`;
	const bak = `${CONFIG_FILE}.bak`;
	const payload = JSON.stringify(config, null, 2);
	// create a backup of existing file if present
	try {
		if (fsSync.existsSync(CONFIG_FILE)) {
			await fs.copyFile(CONFIG_FILE, bak);
		}
	} catch (e) {
		console.warn('roleConfig: backup failed', e);
	}
	// write atomically: write tmp then rename
	await fs.writeFile(tmp, payload, 'utf8');
	await fs.rename(tmp, CONFIG_FILE);
}

// Get schedule creator role for a guild
export async function getScheduleCreatorRole(guildId) {
	const config = await readConfig();
	return config[String(guildId)] || null;
}

// Set schedule creator role for a guild
export async function setScheduleCreatorRole(guildId, roleId) {
	const config = await readConfig();
	config[String(guildId)] = String(roleId || '');
	await writeConfig(config);
	return { ok: true, roleId };
}

// Remove schedule creator role for a guild
export async function removeScheduleCreatorRole(guildId) {
	const config = await readConfig();
	delete config[String(guildId)];
	await writeConfig(config);
	return { ok: true };
}

export default { getScheduleCreatorRole, setScheduleCreatorRole, removeScheduleCreatorRole };
