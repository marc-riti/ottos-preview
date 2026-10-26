// Checks for everything the admin can save. Runs on the local server and in the browser (online admin),
// so it never touches the file system itself: callers pass `exists(imgPath)`, `textKeys` and `images`.
import { validateEvents, DAYS, slug } from './lib.mjs?v=3317ef7c';

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = errors => { if (errors.length) throw new Error(errors.join('\n')); };
const num = v => v === null || v === '' || (typeof v === 'number' && isFinite(v) && v >= 0);

function merch(data, { exists }) {
  const errors = [];
  if (!data || !Array.isArray(data.items)) throw new Error('The store needs a list of items.');
  if (!EMAIL_RE.test(data.paypal || '')) errors.push('The PayPal account must be an email address.');
  if (!Number.isInteger(data.minMugs) || data.minMugs < 0) errors.push('Minimum mugs per order must be a whole number.');
  const ids = new Set();
  data.items.forEach((it, i) => {
    const where = `Item #${i + 1}${it.name ? ` ("${it.name}")` : ''}`;
    if (!it.name || !String(it.name).trim()) errors.push(`${where}: needs a name.`);
    if (!it.id) it.id = slug(it.name || `item-${i}`);
    if (ids.has(it.id)) errors.push(`${where}: two items share the id "${it.id}".`);
    ids.add(it.id);
    if (!['mug', 'wear'].includes(it.kind)) errors.push(`${where}: type must be "mug" or "wear".`);
    if (!num(it.price)) errors.push(`${where}: price must be a number like 11 or 7.50.`);
    if (!num(it.shipping) || !num(it.shippingExtra)) errors.push(`${where}: shipping must be numbers.`);
    if (!it.photo || !/^merch\/[a-z0-9-]+\.(webp|jpg)$/.test(it.photo) || !exists(it.photo)) errors.push(`${where}: needs a photo.`);
    if (it.sizes && !Array.isArray(it.sizes)) errors.push(`${where}: sizes must be a list.`);
  });
  fail(errors);
  return data;
}

function menu(data) {
  const errors = [];
  if (!data || !Array.isArray(data.sections)) throw new Error('The menu needs sections.');
  if (!data.prices) errors.push('The menu needs glass, mug and deposit prices.');
  data.sections.forEach(s => {
    if (!s.title) errors.push('Every menu section needs a title.');
    (s.items || []).forEach((d, i) => { if (!d.name || !String(d.name).trim()) errors.push(`${s.title || 'A section'}: drink #${i + 1} needs a name.`); });
  });
  fail(errors);
  return data;
}

function text(data, { textKeys }) {
  const missing = textKeys.filter(k => !data || typeof data[k] !== 'object');
  if (missing.length) throw new Error(`Page text is missing: ${missing.join(', ')}.`);
  return data;
}

function photos(data, { images }) {
  const errors = [];
  if (!data || typeof data.slots !== 'object') throw new Error('Photos need slots.');
  for (const [id, s] of Object.entries(data.slots)) {
    if (!images[s.src]) errors.push(`${s.label || id}: pick a photo.`);
    if (!s.searchOnly && !String(s.alt || '').trim()) errors.push(`${s.label || id}: describe the photo for people who can't see it.`);
  }
  fail(errors);
  return data;
}

function site(data) {
  const errors = [];
  if (!data || !data.hours || !data.address) throw new Error('Hours and address are missing.');
  for (const d of DAYS) {
    const h = data.hours[d];
    if (h !== null && !(Array.isArray(h) && TIME_RE.test(h[0]) && TIME_RE.test(h[1]))) errors.push(`Hours for ${d}: use times like 16:00 and 01:00, or mark it closed.`);
  }
  for (const k of ['street', 'locality', 'region', 'postal']) if (!String(data.address[k] || '').trim()) errors.push(`Address needs a ${k}.`);
  if (!EMAIL_RE.test(data.email || '')) errors.push('Email address looks wrong.');
  if (!/\d{3}.*\d{4}/.test(data.phoneDisplay || '')) errors.push('Phone number looks wrong.');
  for (const [id, f] of Object.entries(data.facts || {})) if (!['confirmed', 'unconfirmed'].includes(f.status)) errors.push(`Fact "${id}" needs a status.`);
  fail(errors);
  // Keep the dialable number in step with the one people read
  data.phone = '+1-' + String(data.phoneDisplay).replace(/\D/g, '').slice(-10).replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  return data;
}

export const CONTENT = ['events', 'merch', 'menu', 'text', 'photos', 'site'];

// ctx: { exists(imgPath) -> bool, textKeys: [...], images: { base: [...] } }
export function validate(name, data, ctx) {
  switch (name) {
    case 'events': return validateEvents(data);
    case 'merch': return merch(data, ctx);
    case 'menu': return menu(data);
    case 'text': return text(data, ctx);
    case 'photos': return photos(data, ctx);
    case 'site': return site(data);
    default: throw new Error('Unknown content.');
  }
}
