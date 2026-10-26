// Page text: every block of words on the site, page by page. Saves content/text.json.
import { api, h, field, input, area, saveBar, move } from './ui.js';

// [key, label, type]. Types: line, para (blank line = new paragraph), lines (one item per line),
// items (title + text), deal (price + label), press (outlet, title, date, link).
const SCHEMA = {
  home: ['Home', [
    ['kicker', 'Line under the logo', 'line'],
    ['quick', 'Quick facts box (one per line)', 'lines'],
    ['upKick', 'Coming up: small heading', 'line'], ['upTitle', 'Coming up: big heading', 'line'],
    ['picksKick', 'Regular nights: small heading', 'line'], ['picksTitle', 'Regular nights: big heading', 'line'], ['picksText', 'Regular nights: text', 'para'],
    ['drinksKick', 'Drinks: small heading', 'line'], ['drinksTitle', 'Drinks: big heading', 'line'], ['drinksDeal', 'Drinks: price boxes', 'deal'], ['drinksText', 'Drinks: text', 'para'],
    ['backKick', 'Back room: small heading', 'line'], ['backTitle', 'Back room: big heading', 'line'], ['backText', 'Back room: text', 'para'],
    ['findKick', 'Find us: small heading', 'line'], ['findTitle', 'Find us: big heading', 'line'], ['findText', 'Find us: text after the address', 'para']]],
  events: ['Events', [
    ['title', 'Page heading', 'line'], ['lede', 'Intro', 'para'],
    ['beforeTitle', 'Before you go: heading', 'line'], ['before', 'Before you go: points', 'items'],
    ['regularsKick', 'Regular nights: small heading', 'line'], ['regularsTitle', 'Regular nights: big heading', 'line'], ['regularsText', 'Regular nights: text', 'para']]],
  drinks: ['Drinks', [
    ['title', 'Page heading', 'line'], ['lede', 'Intro (the menu note follows it)', 'para'],
    ['dealTitle', 'Glass or mug: heading', 'line'], ['deal', 'Glass or mug: price boxes', 'deal'], ['dealText', 'Glass or mug: text', 'para'],
    ['allergyTitle', 'Allergies: heading', 'line'], ['allergyText', 'Allergies: text', 'para'],
    ['mugsKick', 'Mugs box: small heading', 'line'], ['mugsTitle', 'Mugs box: big heading', 'line'], ['mugsText', 'Mugs box: text', 'para']]],
  merch: ['Merch', [
    ['title', 'Page heading', 'line'], ['lede', 'Intro', 'para'],
    ['atBarTitle', 'At the bar: heading', 'line'], ['atBarDeal', 'At the bar: price boxes', 'deal'], ['atBarText', 'At the bar: text', 'para'],
    ['mugsKick', 'Mugs: small heading', 'line'], ['mugsTitle', 'Mugs: big heading', 'line'], ['mugsText', 'Mugs: text', 'para'],
    ['wearTitle', 'Shirts section heading', 'line'],
    ['orderTitle', 'Ordering: heading', 'line'], ['orderText', 'Ordering: text', 'para']]],
  visit: ['Visit', [
    ['title', 'Page heading', 'line'], ['lede', 'Intro (after the address)', 'para'],
    ['hoursTitle', 'Hours heading', 'line'], ['hoursNote', 'Note under the hours', 'para'],
    ['beforeTitle', 'Before you go: heading', 'line'], ['before', 'Before you go: points', 'items'],
    ['contactTitle', 'Contact heading', 'line'], ['instagramNote', 'Note after the Instagram handle', 'line']]],
  book: ['Book', [
    ['title', 'Page heading', 'line'], ['lede', 'Intro', 'para'],
    ['pitchTitle', 'How to pitch: heading', 'line'], ['pitchTemplate', 'Pitch email template (shown as-is)', 'raw'],
    ['nightsKick', 'Nights: small heading', 'line'], ['nightsTitle', 'Nights: big heading', 'line'], ['nightsText', 'Nights: text', 'para'],
    ['roomTitle', 'The room: heading', 'line'], ['room', 'The room: points', 'items'],
    ['backlineTitle', 'Backline: heading', 'line'], ['backlineNote', 'Backline: note', 'para'], ['backline', 'Backline: gear (one per line)', 'lines'], ['bring', 'What to bring', 'para'],
    ['partiesTitle', 'Parties: heading', 'line'], ['partiesText', 'Parties: text', 'para']]],
  about: ['About', [
    ['title', 'Page heading', 'line'], ['lede', 'Intro', 'para'],
    ['startKick', 'Story: small heading', 'line'], ['startTitle', 'Story: big heading', 'line'], ['startText', 'Story: text', 'para'],
    ['plugKick', 'Music: small heading', 'line'], ['plugTitle', 'Music: big heading', 'line'], ['plugText', 'Music: text', 'para'],
    ['legendsKick', 'Legends: small heading', 'line'], ['legendsTitle', 'Legends: big heading', 'line'], ['legends', 'Legends', 'items'],
    ['pressTitle', 'Press: heading', 'line'], ['press', 'Press list', 'press'],
    ['comeByTitle', 'Come by: heading', 'line'], ['comeByText', 'Come by: text', 'para']]]
};

const SUBFIELDS = {
  items: [['title', 'Bold start', 'line'], ['text', 'Then', 'para']],
  deal: [['price', 'Price', 'line'], ['label', 'Label', 'line']],
  press: [['outlet', 'Publication', 'line'], ['title', 'Headline', 'line'], ['date', 'Date', 'line'], ['url', 'Link (optional)', 'line']]
};
const BLANK = { items: { title: '', text: '' }, deal: { price: '', label: '' }, press: { outlet: '', title: '', date: '', url: '' } };

function control(value, type, onChange) {
  if (type === 'line') return input(value, onChange);
  if (type === 'lines') return area((value || []).join('\n'), v => onChange(v.split('\n').map(s => s.trim()).filter(Boolean)), Math.max(3, (value || []).length + 1));
  return area(value, onChange, type === 'raw' ? 8 : Math.min(8, Math.max(2, Math.ceil(String(value || '').length / 70) + 1)));
}

export const textPanel = {
  id: 'text', label: 'Page text',
  async mount(root) {
    const text = await api.get('text');
    const bar = saveBar('Save text', async () => { await api.save('text', text); });
    const body = h('div');
    let page = 'home';

    const listEditor = (obj, key, type, label) => {
      const wrap = h('fieldset', { class: 'listed' }, h('legend', {}, label));
      const draw = () => {
        const arr = obj[key] = obj[key] || [];
        wrap.replaceChildren(h('legend', {}, label), ...arr.map((row, i) => h('div', { class: 'listed__row' },
          ...SUBFIELDS[type].map(([k, l, t]) => field(`${l} (${i + 1})`, control(row[k], t, v => { row[k] = v; bar.mark(); }))),
          h('div', { class: 'item__btns' },
            h('button', { class: 'btn btn--small btn--ghost', type: 'button', 'aria-label': `Move ${label} ${i + 1} up`, onclick: () => { move(arr, i, -1); bar.mark(); draw(); } }, '↑'),
            h('button', { class: 'btn btn--small btn--ghost', type: 'button', 'aria-label': `Move ${label} ${i + 1} down`, onclick: () => { move(arr, i, 1); bar.mark(); draw(); } }, '↓'),
            h('button', { class: 'btn btn--small btn--danger', type: 'button', onclick: () => { arr.splice(i, 1); bar.mark(); draw(); } }, 'Remove', h('span', { class: 'sr-only' }, ` ${label} ${i + 1}`))))),
          h('button', { class: 'btn btn--small', type: 'button', onclick: () => { arr.push({ ...BLANK[type] }); bar.mark(); draw(); } }, '+ Add one'));
      };
      draw();
      return wrap;
    };

    const render = () => {
      const [, fields] = SCHEMA[page];
      const obj = text[page];
      body.replaceChildren(...fields.map(([key, label, type]) => SUBFIELDS[type]
        ? listEditor(obj, key, type, label)
        : field(label, control(obj[key], type, v => { obj[key] = v; bar.mark(); }))));
    };

    const pagePick = h('div', { class: 'pills', role: 'group', 'aria-label': 'Which page' }, Object.entries(SCHEMA).map(([k, [label]]) =>
      h('button', { type: 'button', class: 'pillbtn', 'aria-pressed': String(k === page), onclick: e => {
        page = k; pagePick.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b === e.currentTarget))); render();
      } }, label)));

    root.append(
      h('p', { class: 'intro' }, 'The words on each page. Pick a page, edit, then save. Shows, drinks, store items and hours have their own tabs.'),
      h('details', { class: 'help' }, h('summary', {}, 'Shortcuts you can type'),
        h('ul', {},
          h('li', {}, h('code', {}, '**Bold words**'), ' makes them bold.'),
          h('li', {}, h('code', {}, '[Drink menu](drinks.html)'), ' makes a link. Pages: index, events, drinks, merch, visit, book, about.'),
          h('li', {}, h('code', {}, '{glass} {mug} {deposit}'), ' fill in the prices from the Drinks menu tab.'),
          h('li', {}, h('code', {}, '{email} {phone} {street} {cross}'), ' fill in the bar\'s details from the Hours & contact tab.'),
          h('li', {}, h('code', {}, '{?backline}'), ' and similar show an "Unconfirmed" tag. Delete them once the bar confirms the fact (or tick it in Hours & contact).'),
          h('li', {}, 'A blank line starts a new paragraph.'))),
      pagePick, body, bar);
    render();
    return bar;
  }
};
