// Admin shell: picks local or online mode, logs in when online, then runs the tabs,
// unsaved-change warnings and the Publish button.
import { api, useApi, h, say, field, input } from './ui.js?v=3317ef7c';
import { githubApi, unlock } from './github.js?v=3317ef7c';
import { showsPanel, regularsPanel } from './shows.js?v=3317ef7c';
import { storePanel } from './store.js?v=3317ef7c';
import { menuPanel } from './menu.js?v=3317ef7c';
import { textPanel } from './text.js?v=3317ef7c';
import { photosPanel } from './photos.js?v=3317ef7c';
import { settingsPanel } from './settings.js?v=3317ef7c';

const PANELS = [showsPanel, regularsPanel, storePanel, menuPanel, textPanel, photosPanel, settingsPanel];
const SESSION = 'otto-admin';
const tabs = document.getElementById('tabs');
const panels = document.getElementById('panels');
const publishBtn = document.getElementById('publish');
const bars = {};
const mounted = {};

async function isLocal() {
  try {
    const r = await fetch('/api/content/site', { cache: 'no-store' });
    return r.ok && (r.headers.get('content-type') || '').includes('json');
  } catch (e) { return false; }
}

async function editorsFile() {
  try { const r = await fetch('/admin/editors.json', { cache: 'no-store' }); return r.ok ? r.json() : null; }
  catch (e) { return null; }
}

function loginScreen(cfg) {
  tabs.parentElement.hidden = true;
  publishBtn.hidden = true;
  const st = { name: '', password: '' };
  const err = h('p', { class: 'errors', role: 'alert' });
  const btn = h('button', { class: 'btn', type: 'submit' }, 'Log in');
  const form = h('form', { class: 'card login', novalidate: true },
    h('h2', {}, 'Log in to edit the site'),
    field('Your name', input('', v => { st.name = v; }, { autocomplete: 'username', autocapitalize: 'words', spellcheck: 'false' })),
    field('Password', input('', v => { st.password = v; }, { type: 'password', autocomplete: 'current-password' })),
    err, btn);
  form.addEventListener('submit', async ev => {
    ev.preventDefault();
    err.textContent = ''; btn.disabled = true; btn.textContent = 'Checking…';
    try {
      const entry = cfg.editors.find(e => e.name.toLowerCase() === st.name.trim().toLowerCase());
      if (!entry) throw new Error('That name isn\'t set up to edit the site. Check the spelling.');
      const token = await unlock(entry, st.password);
      sessionStorage.setItem(SESSION, JSON.stringify({ name: entry.name, token }));
      location.reload();
    } catch (e) { err.textContent = e.message; btn.disabled = false; btn.textContent = 'Log in'; }
  });
  panels.replaceChildren(form);
  form.querySelector('input').focus();
}

function startTabs() {
  const buttons = PANELS.map((p, i) => {
    const b = h('button', { role: 'tab', id: `tab-${p.id}`, 'aria-controls': `panel-${p.id}`, 'aria-selected': 'false', tabindex: '-1', type: 'button' }, p.label);
    b.addEventListener('click', () => open(p.id));
    b.addEventListener('keydown', e => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = PANELS[(i + (e.key === 'ArrowRight' ? 1 : PANELS.length - 1)) % PANELS.length];
      open(next.id); document.getElementById(`tab-${next.id}`).focus();
    });
    tabs.append(b);
    panels.append(h('section', { role: 'tabpanel', id: `panel-${p.id}`, 'aria-labelledby': `tab-${p.id}`, hidden: true }));
    return b;
  });

  async function open(id) {
    buttons.forEach(b => { const on = b.id === `tab-${id}`; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
    PANELS.forEach(p => { document.getElementById(`panel-${p.id}`).hidden = p.id !== id; });
    history.replaceState(null, '', `#${id}`);
    if (mounted[id]) return;
    mounted[id] = true;
    const root = document.getElementById(`panel-${id}`);
    root.append(h('p', { class: 'loading' }, 'Loading…'));
    try {
      const bar = await PANELS.find(p => p.id === id).mount(root);
      if (bar) bars[id] = bar;
    } catch (e) { say(e.message, true); mounted[id] = false; }
    root.querySelector('.loading')?.remove();
  }

  const fromHash = () => { const id = location.hash.slice(1); return PANELS.some(p => p.id === id) ? id : null; };
  window.addEventListener('hashchange', () => { const id = fromHash(); if (id) open(id); });
  open(fromHash() || 'shows');
}

window.addEventListener('beforeunload', e => {
  if (Object.values(bars).some(b => b.dirty)) { e.preventDefault(); e.returnValue = ''; }
});

publishBtn.addEventListener('click', async e => {
  const unsaved = Object.entries(bars).filter(([, b]) => b.dirty).map(([id]) => PANELS.find(p => p.id === id).label);
  if (unsaved.length && !confirm(`${unsaved.join(', ')} ${unsaved.length > 1 ? 'have' : 'has'} unsaved changes that won't be published. Publish anyway?`)) return;
  const btn = e.currentTarget;
  btn.disabled = true; say(api.mode === 'local' ? 'Publishing… this takes about half a minute.' : '');
  try { const r = await api.publish(); say(r.message); }
  catch (err) { say(err.message, true); }
  btn.disabled = false;
});

(async () => {
  if (await isLocal()) return startTabs();
  // Online: every save goes to GitHub and publishes itself
  const cfg = await editorsFile();
  if (!cfg || !cfg.editors || !cfg.editors.length) {
    tabs.parentElement.hidden = true; publishBtn.hidden = true;
    panels.replaceChildren(h('section', { class: 'card' }, h('h2', {}, 'Online editing isn\'t switched on yet'), h('p', {}, 'Ask Marc to finish setting it up.')));
    return;
  }
  let session = null;
  try { session = JSON.parse(sessionStorage.getItem(SESSION) || 'null'); } catch (e) { session = null; }
  if (!session) return loginScreen(cfg);
  useApi(githubApi({ token: session.token, name: session.name, repo: cfg.repo, branch: cfg.branch || 'main' }));
  publishBtn.textContent = 'How publishing works';
  document.querySelector('.top__btns').append(
    h('span', { class: 'who' }, `Logged in as ${session.name}`),
    h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => { sessionStorage.removeItem(SESSION); location.reload(); } }, 'Log out'));
  startTabs();
})();
