// Hours, contact details, address, social links, and ticking off facts the bar has confirmed.
import { api, h, field, input, area, check, saveBar } from './ui.js?v=3317ef7c';

const DAYS = [['sun', 'Sunday'], ['mon', 'Monday'], ['tue', 'Tuesday'], ['wed', 'Wednesday'], ['thu', 'Thursday'], ['fri', 'Friday'], ['sat', 'Saturday']];

export const settingsPanel = {
  id: 'settings', label: 'Hours & contact',
  async mount(root) {
    const site = await api.get('site');
    const bar = saveBar('Save hours & contact', async () => { await api.save('site', site); });
    const today = new Date().toISOString().slice(0, 10);

    const hours = h('fieldset', { class: 'card hours-grid' }, h('legend', {}, 'Opening hours'),
      h('p', { class: 'hint' }, 'A closing time earlier than the opening time means after midnight (4 PM to 1 AM).'),
      DAYS.map(([k, name]) => {
        const row = site.hours[k] || ['16:00', '01:00'];
        const times = h('div', { class: 'hours-row__times' },
          field(`${name} opens`, input(row[0], v => { row[0] = v; if (site.hours[k]) site.hours[k][0] = v; bar.mark(); }, { type: 'time', step: 900 })),
          field(`${name} closes`, input(row[1], v => { row[1] = v; if (site.hours[k]) site.hours[k][1] = v; bar.mark(); }, { type: 'time', step: 900 })));
        times.hidden = !site.hours[k];
        return h('div', { class: 'hours-row' },
          check(`Open on ${name}`, !!site.hours[k], on => { site.hours[k] = on ? row : null; times.hidden = !on; bar.mark(); }),
          times);
      }));

    const a = site.address;
    const s = site.social;
    const contact = h('section', { class: 'card' }, h('h2', {}, 'Contact & address'),
      h('div', { class: 'row2' },
        field('Phone', input(site.phoneDisplay, v => { site.phoneDisplay = v; bar.mark(); }, { type: 'tel', autocomplete: 'off' })),
        field('Email', input(site.email, v => { site.email = v; bar.mark(); }, { type: 'email', autocomplete: 'off' }))),
      h('div', { class: 'row2' },
        field('Street address', input(a.street, v => { a.street = v; bar.mark(); })),
        field('Cross streets', input(a.cross, v => { a.cross = v; bar.mark(); }))),
      h('div', { class: 'row3' },
        field('Neighborhood', input(a.neighborhood, v => { a.neighborhood = v; bar.mark(); })),
        field('City', input(a.locality, v => { a.locality = v; bar.mark(); })),
        field('ZIP', input(a.postal, v => { a.postal = v; bar.mark(); }, { inputmode: 'numeric' }))),
      field('Short description (shown in Google and link previews)', area(site.description, v => { site.description = v; bar.mark(); }, 2)));

    const social = h('section', { class: 'card' }, h('h2', {}, 'Social'),
      h('div', { class: 'row2' },
        field('Instagram handle', input(s.instagram.handle, v => { s.instagram.handle = v; bar.mark(); })),
        field('Instagram link', input(s.instagram.url, v => { s.instagram.url = v; bar.mark(); }, { type: 'url' }))),
      field('Facebook link', input(s.facebook.url, v => { s.facebook.url = v; bar.mark(); }, { type: 'url' })),
      h('div', { class: 'row2' },
        field('X handle', input(s.x.handle, v => { s.x.handle = v; bar.mark(); })),
        field('X link', input(s.x.url, v => { s.x.url = v; bar.mark(); }, { type: 'url' }))));

    const open = Object.entries(site.facts).filter(([, f]) => f.status === 'unconfirmed');
    const facts = h('section', { class: 'card' }, h('h2', {}, 'Facts to confirm'),
      h('p', { class: 'hint' }, 'These show an "Unconfirmed" tag on the site. Tick one once the bar confirms it, and change any wording in Page text if needed.'),
      open.length ? h('ul', { class: 'items' }, open.map(([id, f]) => h('li', { class: 'item item--fact' },
        h('div', {}, h('b', {}, f.label), f.note ? h('span', { class: 'sub' }, f.note) : null),
        check('Confirmed by the bar', false, on => {
          if (on) {
            site.sources['bar-editor'] = site.sources['bar-editor'] || { name: 'The bar, via the site editor', detail: 'Confirmed by the bar in the site admin', url: '', checked: today };
            f.status = 'confirmed'; f.prevSources = f.prevSources || f.sources; f.sources = ['bar-editor']; f.note = `Confirmed by the bar on ${today}.`;
          } else { f.status = 'unconfirmed'; if (f.prevSources) f.sources = f.prevSources; }
          bar.mark();
        }))))
        : h('p', {}, 'Nothing left to confirm.'));

    root.append(h('p', { class: 'intro' }, 'Used on every page: the open-now sign, the footer, directions, the Visit page and what Google shows.'), hours, contact, social, facts, bar);
    return bar;
  }
};
