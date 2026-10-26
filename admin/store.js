// Store: settings (PayPal, checkout switches) and every item for sale. Saves content/merch.json.
import { api, h, say, field, input, area, select, check, dialog, saveBar, move, money, slug } from './ui.js?v=3317ef7c';
import { productPhoto } from './image.js?v=3317ef7c';

const KIND = [['mug', 'Mug'], ['wear', 'Shirt, hoodie, bag or other']];

export const storePanel = {
  id: 'store', label: 'Store',
  async mount(root) {
    const [data, menu] = await Promise.all([api.get('merch'), api.get('menu')]);
    const bar = saveBar('Save store', async () => { await api.save('merch', data); });
    const list = h('div');
    const drinksFor = id => menu.sections.flatMap(s => s.items.filter(d => d.mug === id).map(d => d.name));

    const editors = await fetch('/admin/editors.json', { cache: 'no-store' }).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const locked = !!(editors && (editors.editors || []).some(e => e.reviewOnly));
    const lockable = el => { if (locked) el.querySelector('input').disabled = true; return el; };
    const settings = h('section', { class: 'card' },
      h('h2', {}, 'Store settings'),
      locked ? h('p', { class: 'lockmsg' }, 'Checkout is locked off while a review password is in use. Marc switches it on when the site goes live and everyone gets a strong password.') : null,
      field('PayPal account (email)', input(data.paypal, v => { data.paypal = v.trim(); bar.mark(); }, { type: 'email', autocomplete: 'off' }), 'Orders and payments go to this PayPal account. It\'s the one the old shop page uses.'),
      lockable(check('Checkout is on for the real website', data.checkout, v => { data.checkout = v; bar.mark(); })),
      lockable(check('Also allow checkout on the proverbs.io preview (real orders!)', data.checkoutOnPreview, v => { data.checkoutOnPreview = v; bar.mark(); })),
      field('Mugs per order, at least', input(String(data.minMugs), v => { data.minMugs = Math.max(0, parseInt(v, 10) || 0); bar.mark(); }, { type: 'number', min: 0, max: 10, inputmode: 'numeric' }), 'The old shop only shipped mugs two or more at a time. Set to 0 or 1 to drop the rule.'),
      check('The bar has confirmed these prices and stock (removes the "Unconfirmed" tags)', data.confirmed, v => { data.confirmed = v; bar.mark(); }));

    const render = () => list.replaceChildren(h('ul', { class: 'items items--shop' }, data.items.map((it, i) => h('li', { class: 'item item--shop' },
      h('img', { src: api.imgUrl(it.photo), alt: '', width: 56, height: 70 }),
      h('div', {}, h('b', {}, it.name), ' · ', it.price === null || it.price === '' ? 'no price' : money(it.price),
        it.soldOut ? h('span', { class: 'pill pill--out' }, 'Sold out') : null,
        drinksFor(it.id).length ? h('span', { class: 'sub' }, 'Comes with: ' + drinksFor(it.id).join(', ')) : null),
      h('div', { class: 'item__btns' },
        h('button', { class: 'btn btn--small', type: 'button', onclick: () => edit(it) }, 'Edit', h('span', { class: 'sr-only' }, ` ${it.name}`)),
        h('button', { class: 'btn btn--small btn--ghost', type: 'button', 'aria-label': `Move ${it.name} up`, onclick: () => { move(data.items, i, -1); bar.mark(); render(); } }, '↑'),
        h('button', { class: 'btn btn--small btn--ghost', type: 'button', 'aria-label': `Move ${it.name} down`, onclick: () => { move(data.items, i, 1); bar.mark(); render(); } }, '↓'),
        h('button', { class: 'btn btn--small btn--danger', type: 'button', onclick: () => { if (confirm(`Remove "${it.name}" from the store?`)) { data.items.splice(i, 1); bar.mark(); render(); } } }, 'Delete', h('span', { class: 'sr-only' }, ` ${it.name}`)))))));

    async function edit(existing) {
      const it = existing ? JSON.parse(JSON.stringify(existing)) : { id: '', name: '', kind: 'mug', price: 11, shipping: 7.5, shippingExtra: 5, photo: '', alt: '' };
      let sizes = (it.sizes || []).join(', ');
      const thumb = h('img', { src: it.photo ? api.imgUrl(it.photo) : '', alt: '', width: 80, height: 100, class: 'thumb' });
      const photoMsg = h('small', { 'aria-live': 'polite' });
      const file = h('input', { type: 'file', accept: 'image/*', onchange: async e => {
        const f = e.target.files[0]; if (!f) return;
        photoMsg.textContent = 'Uploading…';
        try {
          const id = it.id || slug(it.name || 'item') || 'item';
          const p = await productPhoto(f, id);
          await api.upload(p.files);
          it.photo = p.path; thumb.src = api.imgUrl(p.path); photoMsg.textContent = 'Photo ready. It\'s cropped to the shop\'s tall shape.';
        } catch (err) { photoMsg.textContent = err.message; }
      } });
      const ok = await dialog(existing ? `Edit ${existing.name}` : 'Add an item', body => {
        body.append(
          field('Name', input(it.name, v => { it.name = v; })),
          field('Type', select(it.kind, KIND, v => { it.kind = v; }), 'Mugs count towards the mugs-per-order rule.'),
          h('div', { class: 'row3' },
            field('Price ($)', input(it.price ?? '', v => { it.price = v === '' ? null : Number(v); }, { type: 'number', min: 0, step: '0.01', inputmode: 'decimal' })),
            field('Shipping, first one ($)', input(it.shipping ?? '', v => { it.shipping = Number(v || 0); }, { type: 'number', min: 0, step: '0.01', inputmode: 'decimal' })),
            field('Each extra one ($)', input(it.shippingExtra ?? '', v => { it.shippingExtra = Number(v || 0); }, { type: 'number', min: 0, step: '0.01', inputmode: 'decimal' }))),
          field('Sizes (optional)', input(sizes, v => { sizes = v; }, { placeholder: 'S, M, L, XL, XXL' }), 'Separate sizes with commas. Leave empty for mugs and bags.'),
          check('Sold out', it.soldOut, v => { it.soldOut = v; }),
          field('Small note (optional)', input(it.note || '', v => { it.note = v; }, { placeholder: 'e.g. Limited run of 100' })),
          h('div', { class: 'fld' }, h('span', { class: 'fld__label' }, 'Photo'), h('div', { class: 'photo-pick' }, thumb, h('div', {}, field('Choose a new photo', file), photoMsg))),
          field('Describe the photo', area(it.alt || '', v => { it.alt = v; }, 2), 'For people using screen readers, e.g. "White lucky-cat mug."')
        );
      }, {
        saveLabel: existing ? 'Done' : 'Add item',
        validate: () => [!(it.name || '').trim() && 'Add a name.', !it.photo && 'Add a photo.', it.price !== null && !(it.price >= 0) && 'Price must be a number.'].filter(Boolean).join(' ')
      });
      if (!ok) return;
      it.name = it.name.trim();
      it.sizes = sizes.split(',').map(s => s.trim()).filter(Boolean);
      if (!it.sizes.length) delete it.sizes;
      if (!it.note) delete it.note;
      if (!it.soldOut) delete it.soldOut;
      if (existing) data.items[data.items.indexOf(existing)] = it;
      else {
        let id = slug(it.name) || 'item', n = 2;
        while (data.items.some(x => x.id === id)) id = `${slug(it.name)}-${n++}`;
        it.id = id;
        data.items.push(it);
      }
      bar.mark(); render();
      say(`"${it.name}" is ready. Press "Save store" to put it on the site.`);
    }

    root.append(
      h('p', { class: 'intro' }, 'What\'s for sale on the Merch page. Which drink comes in which mug is set in the Drinks menu tab.'),
      settings,
      h('section', { class: 'card' }, h('div', { class: 'bar' }, h('h2', {}, 'Items'), h('button', { class: 'btn', type: 'button', onclick: () => edit(null) }, '+ Add an item')), list),
      bar);
    render();
    return bar;
  }
};
