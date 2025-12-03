// `utils/reminder.mjs` stubbed — reminders and notification updates disabled as part of cleanup.
export function startReminders() {
  console.log('startReminders called, but reminders are disabled.');
}

export function stopReminders() {
  // no-op
}

export async function updateNotificationEmbeds() {
  // stub: nothing to update
}

export async function sendNotificationNow() { return { ok: false, reason: 'disabled' }; }
