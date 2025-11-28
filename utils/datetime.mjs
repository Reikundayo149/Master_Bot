import { DateTime } from 'luxon';

const DEFAULT_ZONE = 'Asia/Tokyo';

// Try a few formats and fall back to parsing as ISO or JS Date
export function parseToISO(input) {
  if (!input || !String(input).trim()) return { ok: false, reason: 'empty' };
  const s = String(input).trim();

  // If it's already an ISO-ish string, try parsing
  let dt = DateTime.fromISO(s, { zone: DEFAULT_ZONE });
  if (dt.isValid) return { ok: true, iso: dt.toUTC().toISO(), display: dt.setZone(DEFAULT_ZONE).toFormat("yyyy-LL-dd HH:mm '(JST)'") };

  // Common format: 2025-12-01 18:00
  const fmt1 = DateTime.fromFormat(s, 'yyyy-LL-dd HH:mm', { zone: DEFAULT_ZONE });
  if (fmt1.isValid) return { ok: true, iso: fmt1.toUTC().toISO(), display: fmt1.setZone(DEFAULT_ZONE).toFormat("yyyy-LL-dd HH:mm '(JST)'") };

  // Common without time: 2025-12-01
  const fmt2 = DateTime.fromFormat(s, 'yyyy-LL-dd', { zone: DEFAULT_ZONE });
  if (fmt2.isValid) return { ok: true, iso: fmt2.startOf('day').toUTC().toISO(), display: fmt2.setZone(DEFAULT_ZONE).toFormat("yyyy-LL-dd '(JST)'") };

  // Try RFC2822 / HTTP / JS Date
  const rfc = DateTime.fromRFC2822(s, { zone: DEFAULT_ZONE });
  if (rfc.isValid) return { ok: true, iso: rfc.toUTC().toISO(), display: rfc.setZone(DEFAULT_ZONE).toFormat("yyyy-LL-dd HH:mm '(JST)'") };

  const jsd = DateTime.fromJSDate(new Date(s), { zone: DEFAULT_ZONE });
  if (jsd.isValid) return { ok: true, iso: jsd.toUTC().toISO(), display: jsd.setZone(DEFAULT_ZONE).toFormat("yyyy-LL-dd HH:mm '(JST)'") };

  return { ok: false, reason: 'unparseable' };
}

export function formatISOToTokyo(iso) {
  const dt = DateTime.fromISO(iso, { zone: 'utc' });
  if (!dt.isValid) return null;
  return dt.setZone(DEFAULT_ZONE).toFormat("yyyy-LL-dd HH:mm '(JST)'");
}
