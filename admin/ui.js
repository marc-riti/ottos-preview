// Small helpers shared by every admin tab: talking to the server, building form fields, dialogs.

// Where the admin reads and saves. Local: the Mac's server. Online: GitHub (see github.js), swapped in after login.
export let api;
export function useApi(a) { api = a; }

export const localApi = {
  mode: 'local',
  imgUrl: file => `/admin-img/${file}`,
  async get(name) {
    const r = await fetch(`/api/content/${name}`);
    if (!r.ok) throw new Error('Couldn\'t load. Is the "Start Otto\'s site" window still open?');
    return r.json();
  },
  async save(name, data) {
    let r;
    try { r = await fetch(`/api/content/${name}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }); }
    catch (e) { throw new Error('Couldn\'t reach the site. Is the "Start Otto\'s site" window still open?'); }
    const j = await r.json().catch(() => ({ ok: false, error: 'The site sent back something unexpected.' }));
    if (!j.ok) throw new Error(j.error);
    return j;
  },
  async images() { return (await fetch('/api/images')).json(); },
  async upload(files) {
    const r = await fetch('/api/upload', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ files }) });
    const j = await r.json().catch(() => ({ ok: false, error: 'Upload failed.' }));
    if (!j.ok) throw new Error(j.error);
  },
  async publish() {
    const r = await fetch('/api/publish', { method: 'POST' });
    const j = await r.json().catch(() => ({ ok: false, error: 'Publishing failed.' }));
    if (!j.ok) throw new Error(j.error);
    return j;
  }
};
api = localApi;

// h('div', { class: 'x', onclick: fn }, child, 'text', [more])
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(c));
  return el;
}

let statusTimer;
export function say(msg, bad) {
  const s = document.getElementById('status');
  s.textContent = msg;
  s.className = 'status' + (bad ? ' status--bad' : msg ? ' status--ok' : '');
  clearTimeout(statusTimer);
  if (!bad && msg) statusTimer = setTimeout(() => { if (s.textContent === msg) s.textContent = ''; }, 9000);
}

let uid = 0;
const nextId = () => `f${++uid}`;

// A labelled field. `control` is an input/select/textarea; hint shows under the label.
export function field(label, control, hint) {
  const id = control.id || (control.id = nextId());
  const hintId = hint ? `${id}-h` : null;
  if (hintId) control.setAttribute('aria-describedby', hintId);
  return h('div', { class: 'fld' }, h('label', { for: id }, label), hint ? h('small', { id: hintId }, hint) : null, control);
}

export const input = (value, onInput, attrs = {}) => h('input', { type: 'text', value: value ?? '', oninput: e => onInput(e.target.value), ...attrs });
export const area = (value, onInput, rows = 3, attrs = {}) => h('textarea', { rows, oninput: e => onInput(e.target.value), ...attrs }, value ?? '');
export const check = (label, checked, onChange) => {
  const id = nextId();
  return h('div', { class: 'check' }, h('input', { type: 'checkbox', id, checked: !!checked, onchange: e => onChange(e.target.checked) }), h('label', { for: id }, label));
};
export function select(value, options, onChange, attrs = {}) {
  return h('select', { onchange: e => onChange(e.target.value), ...attrs },
    options.map(([v, label]) => h('option', { value: v, selected: v === value }, label)));
}

// Opens a modal form. build(body) fills it; resolves true when Save is pressed and validate() passes.
export function dialog(title, build, { validate, saveLabel = 'Done' } = {}) {
  return new Promise(resolve => {
    const errors = h('p', { class: 'errors', role: 'alert' });
    const body = h('div', { class: 'dlg__body' });
    const form = h('form', { method: 'dialog', novalidate: true }, h('h2', {}, title), body, errors,
      h('div', { class: 'actions' }, h('button', { class: 'btn', value: 'save' }, saveLabel), h('button', { class: 'btn btn--ghost', value: 'cancel', formnovalidate: true }, 'Cancel')));
    const dlg = h('dialog', {}, form);
    build(body);
    form.addEventListener('submit', ev => {
      if (ev.submitter && ev.submitter.value === 'cancel') return;
      const msg = validate ? validate() : '';
      if (msg) { ev.preventDefault(); errors.textContent = msg; }
    });
    dlg.addEventListener('close', () => { dlg.remove(); resolve(dlg.returnValue === 'save'); });
    document.body.append(dlg);
    dlg.showModal();
    const first = body.querySelector('input, select, textarea');
    if (first) first.focus();
  });
}

// A sticky bar per tab: shows "unsaved changes" and runs the save.
export function saveBar(label, onSave) {
  const note = h('span', { class: 'savebar__note' }, 'No changes yet.');
  const btn = h('button', { class: 'btn', type: 'button', disabled: true }, label || 'Save');
  const bar = h('div', { class: 'savebar' }, note, btn);
  bar.dirty = false;
  bar.mark = () => { bar.dirty = true; btn.disabled = false; note.textContent = 'Unsaved changes.'; bar.classList.add('is-dirty'); };
  bar.clean = () => { bar.dirty = false; btn.disabled = true; note.textContent = 'All changes saved.'; bar.classList.remove('is-dirty'); };
  btn.addEventListener('click', async () => {
    btn.disabled = true; note.textContent = 'Saving…';
    try { const r = await onSave(); bar.clean(); say(r || 'Saved. The site on this computer is updated. Press "Publish online" to update proverbs.io.'); }
    catch (e) { bar.mark(); say(e.message, true); }
  });
  return bar;
}

export const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
export const money = n => (n == null || n === '' ? '' : '$' + (Number.isInteger(+n) ? +n : (+n).toFixed(2)));
export const slug = s => String(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
