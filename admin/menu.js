// Drinks menu: the three glass/mug prices used across the site, every drink, and which mug it comes in.
import { api, h, say, field, input, area, select, check, dialog, saveBar, move } from './ui.js';

export const menuPanel = {
  id: 'menu', label: 'Drinks menu',
  async mount(root) {
    const [menu, merch] = await Promise.all([api.get('menu'), api.get('merch')]);
    const bar = saveBar('Save menu', async () => { await api.save('menu', menu); });
    const mugs = merch.items.filter(i => i.kind === 'mug');
    const mugName = v => (mugs.find(m => m.id === v) || {}).name || v;

    const prices = h('section', { class: 'card' },
      h('h2', {}, 'Glass or mug prices'),
      h('p', { class: 'hint' }, 'Used everywhere the site mentions them (home page, Drinks, Visit, Merch).'),
      h('div', { class: 'row3' },
        field('Tiki drink in a pint glass', input(menu.prices.glass, v => { menu.prices.glass = v; bar.mark(); }, { placeholder: '$18' })),
        field('In a take-home mug', input(menu.prices.mug, v => { menu.prices.mug = v; bar.mark(); }, { placeholder: '$28' })),
        field('Mug deposit', input(menu.prices.deposit, v => { menu.prices.deposit = v; bar.mark(); }, { placeholder: '$10' }))),
      field('Line under the Drinks heading', area(menu.note, v => { menu.note = v; bar.mark(); }, 2)));

    const sections = h('div');
    const render = () => sections.replaceChildren(...menu.sections.map(s => h('section', { class: 'card' },
      h('div', { class: 'bar' }, h('h2', {}, s.title), h('button', { class: 'btn btn--small', type: 'button', onclick: () => edit(s, null) }, '+ Add a drink', h('span', { class: 'sr-only' }, ` to ${s.title}`))),
      field('Line under this section (prices, etc.)', input(s.note || '', v => { s.note = v; bar.mark(); })),
      s.fact ? h('p', { class: 'warn' }, 'Prices in this section are marked "Unconfirmed" on the site. ',
        h('button', { class: 'linkbtn', type: 'button', onclick: () => { delete s.fact; bar.mark(); render(); } }, 'The bar has confirmed them')) : null,
      h('ul', { class: 'items' }, s.items.map((d, i) => h('li', { class: 'item' },
        h('div', {}, h('b', {}, d.name), d.price ? ` · ${d.price}` : '',
          (d.flags || []).length ? h('span', { class: 'pill' }, (d.flags || []).map(f => `contains ${f}`).join(', ')) : null,
          d.mug ? h('span', { class: 'sub' }, `In the ${mugName(d.mug)}`) : null,
          d.fact ? h('span', { class: 'sub warn' }, 'Price marked unconfirmed') : null),
        h('div', { class: 'item__btns' },
          h('button', { class: 'btn btn--small', type: 'button', onclick: () => edit(s, d) }, 'Edit', h('span', { class: 'sr-only' }, ` ${d.name}`)),
          h('button', { class: 'btn btn--small btn--ghost', type: 'button', 'aria-label': `Move ${d.name} up`, onclick: () => { move(s.items, i, -1); bar.mark(); render(); } }, '↑'),
          h('button', { class: 'btn btn--small btn--ghost', type: 'button', 'aria-label': `Move ${d.name} down`, onclick: () => { move(s.items, i, 1); bar.mark(); render(); } }, '↓'),
          h('button', { class: 'btn btn--small btn--danger', type: 'button', onclick: () => { if (confirm(`Take "${d.name}" off the menu?`)) { s.items.splice(i, 1); bar.mark(); render(); } } }, 'Delete', h('span', { class: 'sr-only' }, ` ${d.name}`)))))))));

    async function edit(section, existing) {
      const d = existing ? JSON.parse(JSON.stringify(existing)) : { name: '', desc: '' };
      const flags = new Set(d.flags || []);
      const known = !d.mug || mugs.some(m => m.id === d.mug);
      let mugChoice = !d.mug ? '' : known ? d.mug : '__other';
      let other = known ? '' : d.mug;
      const otherFld = field('Describe the mug', input(other, v => { other = v; }, { placeholder: 'e.g. teal siren mug' }), 'For a mug the shop doesn\'t sell.');
      otherFld.hidden = mugChoice !== '__other';
      const ok = await dialog(existing ? `Edit ${existing.name}` : `Add a drink to ${section.title}`, body => {
        body.append(
          field('Name', input(d.name, v => { d.name = v; })),
          field('Price (optional)', input(d.price || '', v => { d.price = v; }, { placeholder: 'e.g. $48' }), 'Leave empty when the section line gives the price.'),
          field('Description', area(d.desc, v => { d.desc = v; }, 2)),
          check('Contains nuts', flags.has('nuts'), v => { v ? flags.add('nuts') : flags.delete('nuts'); }),
          check('Contains dairy', flags.has('dairy'), v => { v ? flags.add('dairy') : flags.delete('dairy'); }),
          field('Comes in which mug?', select(mugChoice, [['', 'No mug (glass)'], ...mugs.map(m => [m.id, m.name]), ['__other', 'Another mug…']], v => { mugChoice = v; otherFld.hidden = v !== '__other'; }), 'Shows on the Drinks page and in "Which drink comes in which mug" on the Merch page.'),
          otherFld);
      }, { saveLabel: existing ? 'Done' : 'Add drink', validate: () => (!(d.name || '').trim() ? 'Add a name.' : '') });
      if (!ok) return;
      d.name = d.name.trim();
      if (!d.price) delete d.price;
      if (flags.size) d.flags = [...flags]; else delete d.flags;
      const mug = mugChoice === '__other' ? other.trim() : mugChoice;
      if (mug) d.mug = mug; else delete d.mug;
      if (existing) section.items[section.items.indexOf(existing)] = d; else section.items.push(d);
      bar.mark(); render();
      say(`"${d.name}" is ready. Press "Save menu" to put it on the site.`);
    }

    root.append(h('p', { class: 'intro' }, 'The Drinks page. Prices here feed every page that mentions them.'), prices, sections, bar);
    render();
    return bar;
  }
};
