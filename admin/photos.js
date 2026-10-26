// Photos: every picture spot on the site. Upload a new photo or reuse one already on the site.
import { api, h, field, input, area, select, saveBar, slug } from './ui.js';
import { photoSet } from './image.js';

export const photosPanel = {
  id: 'photos', label: 'Photos',
  async mount(root) {
    const [photos, cat] = await Promise.all([api.get('photos'), api.images()]);
    let catalog = cat.photos;
    const bar = saveBar('Save photos', async () => { await api.save('photos', photos); });
    const fileFor = base => (catalog.find(p => p.base === base) || {}).file;
    const nice = base => base.replace(/^uploads\//, 'new: ').replace(/-\d{10,}$/, '').replace(/-/g, ' ');

    const card = (id, s) => {
      const thumb = h('img', { class: 'thumb thumb--wide', src: api.imgUrl(fileFor(s.src)), alt: '', width: 160, height: 107 });
      const msg = h('small', { 'aria-live': 'polite' });
      const pick = select(s.src, catalog.map(p => [p.base, nice(p.base)]), v => { s.src = v; thumb.src = api.imgUrl(fileFor(v)); bar.mark(); });
      const upload = h('input', { type: 'file', accept: 'image/*', onchange: async e => {
        const f = e.target.files[0]; if (!f) return;
        msg.textContent = 'Resizing and uploading…';
        try {
          const set = await photoSet(f, slug(id));
          await api.upload(set.files);
          catalog = (await api.images()).photos;
          s.src = set.base;
          pick.replaceChildren(...catalog.map(p => h('option', { value: p.base, selected: p.base === s.src }, nice(p.base))));
          thumb.src = api.imgUrl(fileFor(s.src));
          msg.textContent = 'New photo ready. Check the description below, then save.';
          bar.mark();
        } catch (err) { msg.textContent = err.message; }
      } });
      return h('section', { class: 'card photo-card' },
        h('h3', {}, s.label),
        h('div', { class: 'photo-pick' }, thumb, h('div', {},
          field('Upload a new photo', upload),
          msg,
          field('Or use a photo already on the site', pick))),
        field('Describe the photo', area(s.alt, v => { s.alt = v; bar.mark(); }, 2), 'For people who can\'t see it. Say what\'s in the picture.'),
        s.searchOnly ? null : field('Caption (optional)', input(s.caption || '', v => { s.caption = v; bar.mark(); })));
    };

    const entries = Object.entries(photos.slots);
    root.append(
      h('p', { class: 'intro' }, 'Every photo spot on the site. Photos are resized automatically, so any phone photo is fine. Shop photos are changed in the Store tab.'),
      h('h2', { class: 'sub-h' }, 'Photos on the pages'),
      h('div', { class: 'photo-grid' }, entries.filter(([, s]) => !s.searchOnly).map(([id, s]) => card(id, s))),
      h('h2', { class: 'sub-h' }, 'Pictures Google shows next to events'),
      h('div', { class: 'photo-grid' }, entries.filter(([, s]) => s.searchOnly).map(([id, s]) => card(id, s))),
      bar);
    return bar;
  }
};
