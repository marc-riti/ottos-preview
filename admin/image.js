// Photos are resized in the browser before upload, so the site stays fast and the build needs no image tools.
// Safari can't save WebP from a canvas, so it falls back to JPEG automatically.

async function open(file) {
  if (!/^image\//.test(file.type)) throw new Error('That file isn\'t a photo.');
  if (file.size > 40e6) throw new Error('That photo is too big (over 40 MB).');
  try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch (e) { throw new Error('This browser can\'t read that photo. Try a JPEG or PNG.'); }
}

async function encode(canvas) {
  const as = (type, q) => new Promise(r => canvas.toBlob(r, type, q));
  let blob = await as('image/webp', 0.78);
  if (blob && blob.type === 'image/webp') return { blob, ext: 'webp' };
  blob = await as('image/jpeg', 0.82);
  return { blob, ext: 'jpg' };
}

function draw(img, w, h, sx = 0, sy = 0, sw = img.width, sh = img.height) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingQuality = 'high';
  g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  return c;
}

const base64 = blob => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1]);
  r.onerror = rej;
  r.readAsDataURL(blob);
});

// Several widths for a page photo: [{ path, data }] ready for api.upload, plus the new photo's name.
export async function photoSet(file, name) {
  const img = await open(file);
  const stamp = Date.now();
  const base = `uploads/${name}-${stamp}`;
  const widths = [480, 800, 1200].filter(w => w <= img.width);
  if (!widths.length) widths.push(img.width);
  const files = [];
  for (const w of widths) {
    const h = Math.round(img.height * w / img.width);
    const { blob, ext } = await encode(draw(img, w, h));
    files.push({ path: `${base}-${w}.${ext}`, data: await base64(blob) });
  }
  return { base, files };
}

// A 4:5 shop photo, cropped from the middle.
export async function productPhoto(file, id) {
  const img = await open(file);
  const ratio = 4 / 5;
  let sw = img.width, sh = img.height;
  if (sw / sh > ratio) sw = Math.round(sh * ratio); else sh = Math.round(sw / ratio);
  const sx = Math.round((img.width - sw) / 2), sy = Math.round((img.height - sh) / 2);
  const { blob, ext } = await encode(draw(img, 400, 500, sx, sy, sw, sh));
  const path = `merch/${id}-${Date.now()}.${ext}`;
  return { path, files: [{ path, data: await base64(blob) }] };
}
