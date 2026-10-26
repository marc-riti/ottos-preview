// Shared helpers for the build: escaping, New York time, formatting, validation.

export const TZ = 'America/New_York';
export const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const KINDS = {
  music: 'Live music',
  dj: 'DJ night',
  comedy: 'Comedy',
  openmic: 'Open mic',
  words: 'Readings',
  market: 'Market',
  party: 'Party'
};

export function esc(s = '') {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Current wall-clock time in New York.
export function nowNY(date = new Date()) {
  const p = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short'
  }).formatToParts(date).forEach(x => { p[x.type] = x.value; });
  return { iso: `${p.year}-${p.month}-${p.day}`, h: +p.hour, min: +p.minute, dow: DAY_SHORT.indexOf(p.weekday) };
}

export function addDays(iso, n) {
  const t = new Date(iso + 'T12:00:00Z');
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

export function dowOf(iso) {
  return new Date(iso + 'T12:00:00Z').getUTCDay();
}

// UTC offset like "-04:00" for a New York wall time on a given date.
export function nyOffset(iso, hhmm = '12:00') {
  const [y, m, d] = iso.split('-').map(Number);
  const [hh, mm] = hhmm.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off = at => {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: TZ, timeZoneName: 'longOffset' })
      .formatToParts(new Date(at)).find(x => x.type === 'timeZoneName').value; // "GMT-04:00"
    const mt = name.match(/GMT([+-])(\d{2}):(\d{2})/);
    return mt ? (mt[1] === '-' ? -1 : 1) * (+mt[2] * 60 + +mt[3]) : 0;
  };
  const minutes = off(guess - off(guess) * 60000);
  const sign = minutes < 0 ? '-' : '+';
  const a = Math.abs(minutes);
  return `${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

export function isoDateTime(date, hhmm) {
  return `${date}T${hhmm}:00${nyOffset(date, hhmm)}`;
}

// "19:00" -> "7 PM", "19:30" -> "7:30 PM", "00:00" -> "Midnight"
export function fmtTime(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  if (h === 0 && m === 0) return 'Midnight';
  const hr = h % 24;
  const ap = hr < 12 ? 'AM' : 'PM';
  const x = hr % 12 || 12;
  return m ? `${x}:${String(m).padStart(2, '0')} ${ap}` : `${x} ${ap}`;
}

export function fmtDate(iso, { long = false } = {}) {
  const [y, m, d] = iso.split('-').map(Number);
  const dow = dowOf(iso);
  return `${long ? DAY_NAMES[dow] : DAY_SHORT[dow]} ${MONTHS[m - 1]} ${d}`;
}

export function monthDay(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return { mon: MONTHS[m - 1], day: d };
}

export function slug(s) {
  return String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
}

// Hours as [openHour, closeHour] indexed by JS weekday; closes after midnight become >24.
export function hoursTable(hours) {
  return DAYS.map(k => {
    const h = hours[k];
    if (!h) return null;
    const toNum = t => { const [a, b] = t.split(':').map(Number); return a + b / 60; };
    const open = toNum(h[0]);
    let close = toNum(h[1]);
    if (close <= open) close += 24;
    return [open, close];
  });
}

// Same rules as assets/live.js, so the baked-in status matches what the browser shows.
export function computeStatus(H, date = new Date()) {
  const n = nowNY(date);
  const mins = n.h * 60 + n.min;
  const clock = h => fmtTime(hhmm(h));
  const y = H[(n.dow + 6) % 7], t = H[n.dow];
  let open = false, closeAt = null, detail = '', late = false;
  if (y && y[1] > 24 && mins < (y[1] - 24) * 60) { open = true; closeAt = y[1]; late = true; }
  else if (t && mins >= t[0] * 60 && (t[1] > 24 || mins < t[1] * 60)) { open = true; closeAt = t[1]; }
  if (open) detail = `Till ${clock(closeAt)}${closeAt > 24 && mins >= 12 * 60 ? ' tonight' : ''}`;
  else if (t && mins < t[0] * 60) detail = `Opens today at ${clock(t[0])}`;
  else {
    for (let k = 1; k <= 7; k++) {
      const nx = H[(n.dow + k) % 7];
      if (nx) { detail = `Opens ${k === 1 ? 'tomorrow' : DAY_NAMES[(n.dow + k) % 7]} at ${clock(nx[0])}`; break; }
    }
  }
  const night = late ? addDays(n.iso, -1) : n.iso;
  const nightDow = late ? (n.dow + 6) % 7 : n.dow;
  return { open, state: open ? 'Open now' : 'Closed now', detail, night, nightDow };
}

export function hoursSummary(hours) {
  // Group identical days, keeping the week order Sun..Sat
  const t = hoursTable(hours);
  const label = r => r ? `${fmtTime(hhmm(r[0]))}–${fmtTime(hhmm(r[1]))}` : 'Closed';
  const groups = [];
  t.forEach((r, i) => {
    const l = label(r);
    const g = groups.find(x => x.label === l);
    if (g) g.days.push(i); else groups.push({ label: l, days: [i] });
  });
  return groups;
}

export function hhmm(n) {
  const h = Math.floor(n) % 24;
  const m = Math.round((n % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function dayList(idxs) {
  // [0,2,3,4] -> "Sun, Tue–Thu"
  const order = idxs.slice().sort((a, b) => a - b);
  const runs = [];
  for (const i of order) {
    const last = runs[runs.length - 1];
    if (last && i === last[1] + 1) last[1] = i; else runs.push([i, i]);
  }
  return runs.map(([a, b]) => a === b ? DAY_SHORT[a] : b === a + 1 ? `${DAY_SHORT[a]}, ${DAY_SHORT[b]}` : `${DAY_SHORT[a]}–${DAY_SHORT[b]}`).join(', ');
}

// Width/height from a WebP header (lossy, lossless or extended), without any image library.
export function webpSize(buf) {
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null;
  const chunk = buf.toString('ascii', 12, 16);
  if (chunk === 'VP8 ') return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
  if (chunk === 'VP8L') {
    const b = buf.readUInt32LE(21);
    return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 };
  }
  if (chunk === 'VP8X') return { w: 1 + buf.readUIntLE(24, 3), h: 1 + buf.readUIntLE(27, 3) };
  return null;
}

// Width/height from a JPEG's start-of-frame marker (Safari can't make WebP, so uploads may be JPEG).
export function jpegSize(buf) {
  if (buf[0] !== 0xff || buf[1] !== 0xd8) return null;
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { w: buf.readUInt16BE(i + 7), h: buf.readUInt16BE(i + 5) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

export function imageSize(buf) { return webpSize(buf) || jpegSize(buf); }

// Catalogue of photos in src/assets/img: "name-480.webp", "name-800.webp" … grouped by name.
export function scanImages(dir, fs, path) {
  const out = {};
  const walk = (sub) => {
    for (const f of fs.readdirSync(path.join(dir, sub))) {
      const rel = sub ? `${sub}/${f}` : f;
      if (fs.statSync(path.join(dir, rel)).isDirectory()) { walk(rel); continue; }
      const m = rel.match(/^(.*)-(\d+)\.(webp|jpg)$/);
      if (!m || rel.startsWith('merch/')) continue;
      const size = imageSize(fs.readFileSync(path.join(dir, rel)));
      if (!size) continue;
      (out[m[1]] = out[m[1]] || []).push({ w: +m[2], file: rel, width: size.w, height: size.h });
    }
  };
  walk('');
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.w - b.w);
  return out;
}

export function money(n) {
  if (n == null || n === '') return '';
  const v = Math.round(Number(n) * 100) / 100;
  return '$' + (Number.isInteger(v) ? v : v.toFixed(2));
}

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Validates and normalises the events file; throws with a readable message.
export function validateEvents(data) {
  const errors = [];
  if (!data || !Array.isArray(data.events)) throw new Error('events.json needs an "events" list.');
  const ids = new Set();
  data.events.forEach((e, i) => {
    const where = `Show #${i + 1}${e.title ? ` ("${e.title}")` : ''}`;
    if (!e.date || !DATE_RE.test(e.date)) errors.push(`${where}: date must look like 2026-10-31.`);
    if (!e.start || !TIME_RE.test(e.start)) errors.push(`${where}: start time must look like 19:00.`);
    if (e.end && !TIME_RE.test(e.end)) errors.push(`${where}: end time must look like 23:00 or be empty.`);
    if (!e.title || !String(e.title).trim()) errors.push(`${where}: needs a title.`);
    if (e.kind && !KINDS[e.kind]) errors.push(`${where}: type "${e.kind}" isn't one of ${Object.keys(KINDS).join(', ')}.`);
    e.lineup = (e.lineup || []).filter(l => l && String(l.act || '').trim());
    e.lineup.forEach(l => { if (l.time && !TIME_RE.test(l.time)) errors.push(`${where}: set time "${l.time}" must look like 21:30.`); });
    if (!e.id) e.id = `${e.date}-${slug(e.title)}`;
    let id = e.id; let n = 2;
    while (ids.has(id)) id = `${e.id}-${n++}`;
    e.id = id; ids.add(id);
  });
  (data.regulars || []).forEach((r, i) => {
    const where = `Regular night #${i + 1}${r.title ? ` ("${r.title}")` : ''}`;
    if (!DAYS.includes(r.day)) errors.push(`${where}: day must be one of ${DAYS.join(', ')}.`);
    if (!r.title) errors.push(`${where}: needs a title.`);
    if (r.start && !TIME_RE.test(r.start)) errors.push(`${where}: start time must look like 19:00.`);
    if (!r.id) r.id = slug(r.title || `regular-${i}`);
  });
  if (errors.length) throw new Error(errors.join('\n'));
  data.events.sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  return data;
}
