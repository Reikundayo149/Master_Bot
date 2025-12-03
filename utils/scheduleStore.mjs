// `utils/scheduleStore.mjs` removed — replaced with a safe stub to disable DB-backed schedule storage.

export async function listSchedules() { return []; }
export async function getSchedule(id) { return null; }
export async function createSchedule() { return null; }
export async function updateSchedule() { return { ok: false }; }
export async function deleteSchedule() { return false; }
export async function addAttendance() { return false; }
export async function removeAttendance() { return false; }
export async function addNotificationMessage() { return false; }
export async function getNotificationMessages() { return []; }
export async function markNotified() { return false; }

export default { listSchedules, getSchedule, createSchedule, updateSchedule, deleteSchedule, addNotificationMessage, getNotificationMessages, addAttendance, removeAttendance, markNotified };
