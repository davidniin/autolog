// Reminders as a calendar feed (iCalendar, RFC 5545) to subscribe from Google Calendar, Apple Calendar or Outlook:
//   GET /v1/calendar.ics?key=<calendar key>&lang=es|en
// Calendar apps can't send our password, so the URL carries its own key: read-only and only for this feed. It's
// created on first use, stored in autolog_setting and can be replaced (POST /v1/calendar/reset), which revokes the old URL.
// - Reminders with a due date → an all-day event on that date, with an alert one week before.
// - Reminders by mileage only → an ESTIMATED date from the km driven per day in the last months (marked as estimated).
import crypto from 'node:crypto';
import { sql } from './db.js';
import { getSetting, setSetting, getPrefs } from './settings.js';
import { msg } from './messages.js';


export async function calendarKey(reset = false) {
  let key = reset ? null : await getSetting('calendar_key');
  if (!key) {
    key = crypto.randomBytes(24).toString('base64url');
    await setSetting('calendar_key', key);
  }
  return key;
}
export async function checkCalendarKey(given) {
  const key = await getSetting('calendar_key');
  if (!key || !given) return false;
  const a = crypto.createHash('sha256').update(String(given)).digest(), b = crypto.createHash('sha256').update(key).digest();
  return crypto.timingSafeEqual(a, b);
}

// ------------------------------------------------------------ iCalendar helpers
const esc = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
// Lines longer than 75 octets are folded (RFC 5545 §3.1)
function fold(line) {
  const out = [];
  let cur = '', bytes = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > 75) { out.push(cur); cur = ' '; bytes = 1; }
    cur += ch; bytes += n;
  }
  out.push(cur);
  return out.join('\r\n');
}
const day = (d) => d.replace(/-/g, '');
const addDays = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const stamp = () => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

// km per day of a vehicle over the last ~6 months (null if there isn't enough data)
function kmPerDay(points) {
  const since = addDays(new Date().toISOString().slice(0, 10), -183);
  const recent = points.filter((p) => p.date >= since && p.km > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (recent.length < 2) return null;
  const a = recent[0], b = recent[recent.length - 1];
  const days = (Date.parse(b.date) - Date.parse(a.date)) / 864e5;
  return days >= 14 && b.km > a.km ? (b.km - a.km) / days : null;
}

export async function calendarICS(lang = 'es') {
  const M = msg(lang);
  const distance = ((await getPrefs()) || {}).distance || 'km';
  const [reminders, points, vehicles] = await Promise.all([
    sql`select r.id, r.title, r.due_date::text as due_date, r.due_km, r.note, v.id as vehicle_id, v.name as vehicle
        from autolog_reminder r join autolog_vehicle v on v.id = r.vehicle_id`,
    sql`select vehicle_id, date::text as date, km from autolog_fuel
        union all select vehicle_id, date::text as date, km from autolog_expense where km is not null`,
    sql`select id, start_km from autolog_vehicle`,
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//AutoLog//Reminders//' + lang.toUpperCase(), 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', 'X-WR-CALNAME:' + esc(M.calName), 'X-PUBLISHED-TTL:PT6H', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H'];
  for (const r of reminders) {
    let date = r.due_date, estimated = false;
    const vpoints = points.filter((p) => p.vehicle_id === r.vehicle_id);
    const v = vehicles.find((x) => x.id === r.vehicle_id);
    const kmNow = Math.max(v && v.start_km ? v.start_km : 0, ...vpoints.map((p) => p.km));
    const kmLeft = r.due_km != null ? r.due_km - kmNow : null;
    // Only mileage: estimate the date (or bring it forward if the km arrive before the due date)
    const rate = kmLeft != null ? kmPerDay(vpoints) : null;
    if (kmLeft != null && rate) {
      const est = addDays(today, Math.max(0, Math.round(kmLeft / rate)));
      if (!date || est < date) { date = est; estimated = true; }
    }
    if (!date) continue; // by mileage with no driving history yet: nothing to put on a calendar
    const dist = (km) => M.dist(km, distance);
    const desc = [r.vehicle, kmLeft != null ? (kmLeft <= 0 ? M.overBy(dist(-kmLeft)) : M.left(dist(kmLeft))) : '',
      estimated ? M.estimated : '', r.note || ''].filter(Boolean).join('\n');
    lines.push('BEGIN:VEVENT', 'UID:' + r.id + '@autolog', 'DTSTAMP:' + stamp(),
      'DTSTART;VALUE=DATE:' + day(date), 'DTEND;VALUE=DATE:' + day(addDays(date, 1)),
      'SUMMARY:' + esc('🔔 ' + r.title + ' · ' + r.vehicle + (estimated ? ' (~)' : '')),
      'DESCRIPTION:' + esc(desc), 'TRANSP:TRANSPARENT',
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(r.title), 'TRIGGER:-P7D', 'END:VALARM', 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
