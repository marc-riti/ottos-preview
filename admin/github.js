// Online admin: reads and saves content straight to the site's GitHub repo with the token unlocked at login.
// Every save is a commit; the repo's publish workflow rebuilds proverbs.io about two minutes later.
import { validate } from './validate.mjs?v=3317ef7c';

const API = 'https://api.github.com';
const LABELS = { events: 'shows', merch: 'store', menu: 'drinks menu', text: 'page text', photos: 'photos', site: 'hours & contact' };

const toText = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, '')), c => c.charCodeAt(0)));
function toB64(str) {
  let bin = '';
  new TextEncoder().encode(str).forEach(b => { bin += String.fromCharCode(b); });
  return btoa(bin);
}
function todayNY() {
  const p = {};
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}`;
}

export function githubApi({ token, name, repo, branch }) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const shas = {};
  const uploaded = {}; // photos added this visit, shown before the site rebuilds
  let files = null;

  async function gh(path, opts = {}) {
    let r;
    try { r = await fetch(API + path, { ...opts, headers: { ...headers, ...(opts.body ? { 'Content-Type': 'application/json' } : {}) } }); }
    catch (e) { throw new Error('Couldn\'t reach GitHub. Check the internet connection and try again.'); }
    if (r.status === 401) throw new Error('Your login has expired. Ask Marc to renew it.');
    if (r.status === 409 || (r.status === 422 && opts.method === 'PUT')) throw Object.assign(new Error('Someone else saved this part of the site a moment ago. Reload the page to see their changes, then make yours again.'), { conflict: true });
    if (!r.ok) throw new Error(`GitHub said no (${r.status}). Try again in a minute.`);
    return r.json();
  }

  async function tree() {
    if (!files) {
      const t = await gh(`/repos/${repo}/git/trees/${branch}?recursive=1`);
      files = new Set(t.tree.filter(x => x.type === 'blob').map(x => x.path));
    }
    return files;
  }

  async function catalog() {
    const out = {};
    for (const f of await tree()) {
      if (!f.startsWith('src/assets/img/') || f.startsWith('src/assets/img/merch/')) continue;
      const rel = f.slice('src/assets/img/'.length);
      const m = rel.match(/^(.*)-(\d+)\.(webp|jpg)$/);
      if (m) (out[m[1]] = out[m[1]] || []).push({ w: +m[2], file: rel });
    }
    for (const k of Object.keys(out)) out[k].sort((a, b) => a.w - b.w);
    return out;
  }

  const api = {
    mode: 'github',
    user: name,
    imgUrl: file => uploaded[file] || `/assets/img/${file}`,
    async get(n) {
      const f = await gh(`/repos/${repo}/contents/content/${n}.json?ref=${branch}`);
      shas[n] = f.sha;
      return JSON.parse(toText(f.content));
    },
    async save(n, data) {
      const [imgs, text] = await Promise.all([catalog(), n === 'text' ? api.get('text') : null]);
      const all = await tree();
      validate(n, data, {
        exists: p => all.has(`src/assets/img/${p}`) || !!uploaded[p],
        textKeys: text ? Object.keys(text) : [],
        images: imgs
      });
      if (n === 'events') data.updated = todayNY();
      if (!shas[n]) await api.get(n);
      const res = await gh(`/repos/${repo}/contents/content/${n}.json`, {
        method: 'PUT',
        body: JSON.stringify({ message: `Site edits by ${name}: ${LABELS[n] || n}`, content: toB64(JSON.stringify(data, null, 2) + '\n'), sha: shas[n], branch })
      });
      shas[n] = res.content.sha;
      const upcoming = n === 'events' ? data.events.filter(e => e.date >= todayNY()).length : 0;
      return { ok: true, upcoming };
    },
    async images() {
      const c = await catalog();
      return { photos: Object.entries(c).map(([base, set]) => ({ base, file: set[0].file })) };
    },
    async upload(list) {
      const all = await tree();
      for (const f of list) {
        await gh(`/repos/${repo}/contents/src/assets/img/${f.path}`, {
          method: 'PUT',
          body: JSON.stringify({ message: `Photo added by ${name}`, content: f.data, branch })
        });
        all.add(`src/assets/img/${f.path}`);
        uploaded[f.path] = `data:image/${f.path.endsWith('.jpg') ? 'jpeg' : 'webp'};base64,${f.data}`;
      }
    },
    async publish() {
      return { ok: true, message: 'Nothing to press: every save goes live on proverbs.io by itself, about 2 minutes later.' };
    }
  };
  return api;
}

// Unlocks the GitHub token stored for an editor (AES-GCM, key from the password via PBKDF2-SHA256).
export async function unlock(entry, password) {
  const b = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b(entry.salt), iterations: entry.iter, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
  try { return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b(entry.iv) }, key, b(entry.data))); }
  catch (e) { throw new Error('That password isn\'t right.'); }
}
