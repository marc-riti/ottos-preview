// Shows (dated listings) and Regular nights. Both live in content/events.json.
import { api, h, say, field, input, area, select, check, dialog } from './ui.js?v=3317ef7c';

const KINDS = { music: 'Live music', dj: 'DJ night', comedy: 'Comedy', openmic: 'Open mic', words: 'Readings', market: 'Market', party: 'Party' };
const DAYS = { sun: 'Sunday', mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday', sat: 'Saturday' };
const WHICH = { every: 'Every week', 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', last: 'Last' };
const kindOptions = Object.entries(KINDS);

let data = null;
const listeners = [];
async function load() { data = await api.get('events'); data.regulars = data.regulars || []; listeners.forEach(f => f()); }
async function save(what) {
  const r = await api.save('events', data);
  await load();
  say(`${what} Saved. ${r.upcoming} upcoming shows on the site on this computer. Press "Publish online" to update proverbs.io.`);
}

function todayNY() {
  const p = {};
  new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' })
    .formatToParts(new Date()).forEach(x => { p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}`;
}
const fmtTime = t => { if (!t) return ''; const hr = +t.slice(0, 2), m = t.slice(3, 5), x = hr % 12 || 12; return x + (+m ? ':' + m : '') + (hr < 12 ? ' AM' : ' PM'); };
const fmtDate = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });

// "9:30 PM The Supertones", "21:30 The Supertones", "9pm - The Supertones" -> { time: "21:30", act: "The Supertones" }
export function parseLine(line) {
  const m = line.match(/^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.m\.|p\.m\.|a|p)?\s*[-–—:.]?\s+(.+)$/i);
  if (!m) return { time: '', act: line.trim() };
  let hr = +m[1]; const min = m[2] ? +m[2] : 0; const ap = (m[3] || '').toLowerCase().charAt(0);
  if (hr > 23 || min > 59) return { time: '', act: line.trim() };
  if (ap === 'p' && hr < 12) hr += 12;
  else if (ap === 'a' && hr === 12) hr = 0;
  else if (!ap && hr >= 3 && hr <= 11) hr += 12; // the bar opens at 4 PM, so a bare "9" means 9 PM
  return { time: String(hr).padStart(2, '0') + ':' + String(min).padStart(2, '0'), act: m[4].trim() };
}
const parseLineup = text => text.split('\n').map(l => l.trim()).filter(Boolean).map(parseLine);
const lineupText = list => (list || []).map(l => (l.time ? fmtTime(l.time) + ' ' : '') + l.act).join('\n');

async function editShow(existing, copy) {
  const src = existing ? JSON.parse(JSON.stringify(existing)) : { date: todayNY(), start: '19:00', kind: 'music', lineup: [] };
  const e = { ...src, date: copy ? '' : src.date };
  let lineup = lineupText(src.lineup);
  const preview = h('div', { class: 'preview', 'aria-live': 'polite' });
  const showPreview = () => {
    const l = parseLineup(lineup);
    preview.replaceChildren(...(l.length ? ['Will show as:', h('ul', {}, l.map(x => h('li', {}, h('b', {}, x.time ? fmtTime(x.time) : 'w/'), ' ', x.act)))] : []));
  };
  const ok = await dialog(existing && !copy ? 'Edit show' : copy ? 'Copy show to a new date' : 'Add a show', body => {
    body.append(
      h('div', { class: 'row3' },
        field('Date', input(e.date, v => { e.date = v; }, { type: 'date', required: true })),
        field('Starts', input(e.start, v => { e.start = v; }, { type: 'time', step: 300, required: true })),
        field('Ends (optional)', input(e.end || '', v => { e.end = v; }, { type: 'time', step: 300 }))),
      field('Title', input(e.title || '', v => { e.title = v; }, { placeholder: 'e.g. Get Weird! Halloween Show' }), 'For a plain band night, call it "Live music". The site names it after the bands.'),
      field('Type', select(e.kind || 'music', kindOptions, v => { e.kind = v; })),
      field('Line-up (one act per line)', area(lineup, v => { lineup = v; showPreview(); }, 6, { placeholder: '8 PM The Rover Boys Trio\n9:30 PM Band of Others\nDJ Greg-Gory' }), 'Start a line with a time to list a set time. Lines without a time show as "w/".'),
      preview,
      field('Description (optional)', area(e.description || '', v => { e.description = v; }, 3)),
      field('Cover / entry (optional)', input(e.cover || '', v => { e.cover = v; }, { list: 'covers', placeholder: 'No cover' })),
      h('datalist', { id: 'covers' }, ['No cover', 'No cover · pay what you can', 'One-drink minimum'].map(v => h('option', { value: v }))),
      field('Not confirmed? (optional)', area(e.unconfirmed || '', v => { e.unconfirmed = v; }, 2, { placeholder: 'e.g. Date clashes with the regular schedule' }), 'Anything written here shows an "Unconfirmed" tag on the show.')
    );
    showPreview();
  }, {
    saveLabel: 'Save show',
    validate: () => [!e.date && 'Pick a date.', !e.start && 'Add a start time.', !(e.title || '').trim() && 'Add a title.'].filter(Boolean).join(' ')
  });
  if (!ok) return;
  const out = { id: existing && !copy ? existing.id : undefined, date: e.date, start: e.start.slice(0, 5), title: e.title.trim(), kind: e.kind, lineup: parseLineup(lineup), description: (e.description || '').trim(), sources: existing && !copy && existing.sources ? existing.sources : ['editor'] };
  if (e.end) out.end = e.end.slice(0, 5);
  if ((e.cover || '').trim()) out.cover = e.cover.trim();
  if ((e.unconfirmed || '').trim()) out.unconfirmed = e.unconfirmed.trim();
  if (existing && existing.presenter) out.presenter = existing.presenter;
  if (existing && !copy) data.events[data.events.indexOf(existing)] = out; else data.events.push(out);
  try { await save(`"${out.title}" on ${fmtDate(out.date)}.`); } catch (err) { say(err.message, true); await load(); }
}

async function editRegular(existing) {
  const r = existing ? JSON.parse(JSON.stringify(existing)) : { day: 'tue', which: ['every'], start: '21:00', kind: 'music', title: '', description: '' };
  const which = new Set(r.which);
  const ok = await dialog(existing ? 'Edit regular night' : 'Add a regular night', body => {
    body.append(
      h('div', { class: 'row3' },
        field('Day', select(r.day, Object.entries(DAYS), v => { r.day = v; })),
        field('Starts', input(r.start, v => { r.start = v; }, { type: 'time', step: 300 })),
        field('Ends (optional)', input(r.end || '', v => { r.end = v; }, { type: 'time', step: 300 }))),
      h('fieldset', {}, h('legend', {}, 'Which weeks'), Object.entries(WHICH).map(([k, label]) => check(label, which.has(k), on => { on ? which.add(k) : which.delete(k); }))),
      field('Title', input(r.title, v => { r.title = v; })),
      field('Type', select(r.kind, kindOptions, v => { r.kind = v; })),
      field('Description', area(r.description || '', v => { r.description = v; }, 3)),
      field('Not confirmed? (optional)', area(r.unconfirmed || '', v => { r.unconfirmed = v; }, 2))
    );
  }, {
    saveLabel: 'Save night',
    validate: () => [!(r.title || '').trim() && 'Add a title.', !r.start && 'Add a start time.', !which.size && 'Tick at least one week.'].filter(Boolean).join(' ')
  });
  if (!ok) return;
  let w = [...which]; if (w.includes('every')) w = ['every'];
  const out = { id: existing ? existing.id : undefined, day: r.day, which: w, start: r.start.slice(0, 5), title: r.title.trim(), kind: r.kind, description: (r.description || '').trim() };
  if (r.end) out.end = r.end.slice(0, 5);
  if ((r.unconfirmed || '').trim()) out.unconfirmed = r.unconfirmed.trim();
  if (existing) data.regulars[data.regulars.indexOf(existing)] = out; else data.regulars.push(out);
  try { await save(`"${out.title}".`); } catch (err) { say(err.message, true); await load(); }
}

export const showsPanel = {
  id: 'shows', label: 'Shows',
  async mount(root) {
    let past = false;
    const list = h('div');
    const render = () => {
      if (!data) return;
      const today = todayNY();
      const items = data.events.filter(e => (past ? e.date < today : e.date >= today));
      const groups = {};
      items.forEach(e => { (groups[e.date] = groups[e.date] || []).push(e); });
      const dates = Object.keys(groups).sort(); if (past) dates.reverse();
      list.replaceChildren(...(dates.length ? dates.map(d => h('section', { class: 'day' },
        h('h2', {}, fmtDate(d), d === today ? h('span', { class: 'pill' }, 'Tonight') : null),
        h('ul', { class: 'items' }, groups[d].map(e => h('li', { class: 'item' },
          h('div', {}, h('b', {}, fmtTime(e.start)), ' · ', e.title,
            e.lineup && e.lineup.length ? h('span', { class: 'sub' }, e.lineup.map(l => l.act).join(', ')) : null,
            e.unconfirmed ? h('span', { class: 'sub warn' }, 'Unconfirmed: ' + e.unconfirmed) : null),
          h('div', { class: 'item__btns' },
            h('button', { class: 'btn btn--small', type: 'button', onclick: () => editShow(e) }, 'Edit', h('span', { class: 'sr-only' }, ` ${e.title}, ${fmtDate(d)}`)),
            h('button', { class: 'btn btn--small btn--ghost', type: 'button', onclick: () => editShow(e, true) }, 'Copy', h('span', { class: 'sr-only' }, ` ${e.title}`)),
            h('button', { class: 'btn btn--small btn--danger', type: 'button', onclick: async () => {
              if (!confirm(`Delete "${e.title}" on ${fmtDate(d)}?`)) return;
              data.events.splice(data.events.indexOf(e), 1);
              try { await save(`Deleted "${e.title}".`); } catch (err) { say(err.message, true); await load(); }
            } }, 'Delete', h('span', { class: 'sr-only' }, ` ${e.title}, ${fmtDate(d)}`))))))))
        : [h('p', { class: 'empty' }, past ? 'No past shows.' : 'No upcoming shows yet. Add one above.')]));
    };
    listeners.push(render);
    root.append(
      h('p', { class: 'intro' }, 'Every show on the site. Saving updates tonight\'s flyer, the Events page and what Google sees.'),
      h('div', { class: 'bar' },
        h('button', { class: 'btn', type: 'button', onclick: () => editShow(null) }, '+ Add a show'),
        check('Show past shows', false, v => { past = v; render(); }),
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: async () => {
          const t = todayNY(), n = data.events.filter(e => e.date < t).length;
          if (!n) return say('No past shows to delete.');
          if (!confirm(`Delete ${n} past show${n > 1 ? 's' : ''}? A backup is kept.`)) return;
          data.events = data.events.filter(e => e.date >= t);
          try { await save(`Deleted ${n} past shows.`); } catch (err) { say(err.message, true); await load(); }
        } }, 'Delete past shows')),
      list);
    await load();
  }
};

export const regularsPanel = {
  id: 'regulars', label: 'Regular nights',
  async mount(root) {
    const list = h('div');
    const order = Object.keys(DAYS);
    const render = () => {
      if (!data) return;
      const regs = data.regulars.slice().sort((a, b) => order.indexOf(a.day) - order.indexOf(b.day) || (a.start || '').localeCompare(b.start || ''));
      list.replaceChildren(regs.length ? h('ul', { class: 'items' }, regs.map(r => h('li', { class: 'item' },
        h('div', {}, h('b', {}, r.which.map(w => WHICH[w]).join(' & '), ' ', DAYS[r.day]), ' · ', fmtTime(r.start), ' · ', r.title,
          r.unconfirmed ? h('span', { class: 'sub warn' }, 'Unconfirmed: ' + r.unconfirmed) : null),
        h('div', { class: 'item__btns' },
          h('button', { class: 'btn btn--small', type: 'button', onclick: () => editRegular(r) }, 'Edit', h('span', { class: 'sr-only' }, ` ${r.title}`)),
          h('button', { class: 'btn btn--small btn--danger', type: 'button', onclick: async () => {
            if (!confirm(`Delete the regular night "${r.title}"?`)) return;
            data.regulars.splice(data.regulars.indexOf(r), 1);
            try { await save(`Deleted "${r.title}".`); } catch (err) { say(err.message, true); await load(); }
          } }, 'Delete', h('span', { class: 'sr-only' }, ` ${r.title}`))))))
        : h('p', { class: 'empty' }, 'No regular nights.'));
    };
    listeners.push(render);
    root.append(
      h('p', { class: 'intro' }, 'The weekly and monthly guide on the Events, Home and Book pages. These don\'t create dated shows: add each date under Shows too.'),
      h('div', { class: 'bar' }, h('button', { class: 'btn', type: 'button', onclick: () => editRegular(null) }, '+ Add a regular night')),
      list);
    if (!data) await load(); else render();
  }
};
