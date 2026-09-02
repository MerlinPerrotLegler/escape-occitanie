import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function which(bin) {
  const result = spawnSync('which', [bin], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

function readDimensions(file) {
  const sips = which('sips');
  if (sips) {
    const out = spawnSync(sips, ['-g', 'pixelWidth', '-g', 'pixelHeight', file], { encoding: 'utf8' });
    const width = Number(/pixelWidth:\s*(\d+)/.exec(out.stdout)?.[1] || 0);
    const height = Number(/pixelHeight:\s*(\d+)/.exec(out.stdout)?.[1] || 0);
    if (width && height) return { width, height };
  }
  const python = which('python3');
  if (python) {
    const out = spawnSync(
      python,
      ['-c', 'from PIL import Image; im=Image.open("' + file.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"); print(im.size[0], im.size[1])'],
      { encoding: 'utf8' }
    );
    const parts = out.stdout.trim().split(/\s+/);
    const width = Number(parts[0] || 0);
    const height = Number(parts[1] || 0);
    if (width && height) return { width, height };
  }
  return { width: 0, height: 0 };
}

function toWebp(from, dest, maxWidth, quality = 75) {
  const cwebp = which('cwebp');
  if (cwebp) {
    const result = spawnSync(cwebp, ['-q', String(quality), '-m', '6', '-resize', String(maxWidth), '0', from, '-o', dest], {
      encoding: 'utf8',
    });
    return result.status === 0 && fs.existsSync(dest) && fs.statSync(dest).size > 0;
  }
  const python = which('python3');
  if (!python) return false;
  const script = `
from PIL import Image
im = Image.open(r'''${from}''')
im.thumbnail((${maxWidth}, ${maxWidth * 4}))
im.save(r'''${dest}''', 'WEBP', quality=${quality}, method=6)
`;
  const result = spawnSync(python, ['-c', script], { encoding: 'utf8' });
  return result.status === 0 && fs.existsSync(dest) && fs.statSync(dest).size > 0;
}

function toJpeg(from, dest, maxWidth, quality = 78) {
  const sips = which('sips');
  if (sips) {
    const tmp = dest.endsWith('.jpg') ? dest : dest + '.jpg';
    const result = spawnSync(sips, ['-Z', String(maxWidth), '-s', 'format', 'jpeg', '-s', 'formatOptions', String(quality), from, '--out', tmp], {
      encoding: 'utf8',
    });
    return result.status === 0 && fs.existsSync(tmp) && fs.statSync(tmp).size > 0;
  }
  const python = which('python3');
  if (!python) return false;
  const script = `
from PIL import Image
im = Image.open(r'''${from}''')
if im.mode in ('RGBA', 'P'):
    bg = Image.new('RGB', im.size, (18, 15, 13))
    im = im.convert('RGBA')
    bg.paste(im, mask=im.split()[-1])
    im = bg
elif im.mode != 'RGB':
    im = im.convert('RGB')
im.thumbnail((${maxWidth}, ${maxWidth * 4}))
im.save(r'''${dest}''', 'JPEG', quality=${quality}, optimize=True)
`;
  const result = spawnSync(python, ['-c', script], { encoding: 'utf8' });
  return result.status === 0 && fs.existsSync(dest) && fs.statSync(dest).size > 0;
}

function toPng(from, dest, size) {
  const sips = which('sips');
  if (sips) {
    const result = spawnSync(
      sips,
      ['-z', String(size), String(size), '-s', 'format', 'png', from, '--out', dest],
      { encoding: 'utf8' }
    );
    if (result.status === 0 && fs.existsSync(dest) && fs.statSync(dest).size > 0) return true;
  }
  const python = which('python3');
  if (!python) return false;
  const script = `
from PIL import Image
im = Image.open(r'''${from}''')
im = im.convert('RGBA')
im = im.resize((${size}, ${size}), Image.Resampling.LANCZOS)
im.save(r'''${dest}''', 'PNG', optimize=True)
`;
  const result = spawnSync(python, ['-c', script], { encoding: 'utf8' });
  return result.status === 0 && fs.existsSync(dest) && fs.statSync(dest).size > 0;
}

function toIco(from, dest) {
  const python = which('python3');
  if (!python) return false;
  const script = `
from PIL import Image
im = Image.open(r'''${from}''').convert('RGBA')
im.save(r'''${dest}''', 'ICO', sizes=[(16, 16), (32, 32), (48, 48)])
`;
  const result = spawnSync(python, ['-c', script], { encoding: 'utf8' });
  return result.status === 0 && fs.existsSync(dest) && fs.statSync(dest).size > 0;
}

export function publishFavicons(from, publicDir) {
  if (!from || !publicDir || !fs.existsSync(from)) return [];
  fs.mkdirSync(publicDir, { recursive: true });
  const written = [];
  const pngs = [
    ['favicon-48x48.png', 48],
    ['favicon-192x192.png', 192],
    ['apple-touch-icon.png', 180],
  ];
  for (const [name, size] of pngs) {
    const dest = path.join(publicDir, name);
    if (toPng(from, dest, size)) written.push(name);
  }
  if (toIco(from, path.join(publicDir, 'favicon.ico'))) written.push('favicon.ico');
  return written;
}

export function publishLocalImage(from, mediaDir, relPosix) {
  const ext = path.extname(relPosix);
  const stem = relPosix.slice(0, relPosix.length - ext.length);
  const destOriginal = path.join(mediaDir, ...relPosix.split('/'));
  fs.mkdirSync(path.dirname(destOriginal), { recursive: true });
  fs.copyFileSync(from, destOriginal);

  const dims = readDimensions(from);
  const published = {
    src: `/media/${relPosix}`,
    webp: '',
    srcSet: '',
    width: dims.width,
    height: dims.height,
  };

  const fullWebp = path.join(mediaDir, `${stem}.webp`);
  if (toWebp(from, fullWebp, 1200)) {
    published.webp = `/media/${stem}.webp`;
    const parts = [`/media/${stem}.webp ${Math.min(dims.width || 1200, 1200)}w`];
    if ((dims.width || 0) > 800) {
      const mobileWebp = path.join(mediaDir, `${stem}-800.webp`);
      if (toWebp(from, mobileWebp, 800)) {
        parts.unshift(`/media/${stem}-800.webp 800w`);
      }
    }
    published.srcSet = parts.join(', ');
  }

  if (!ext.match(/\.jpe?g$/i)) {
    const jpegDest = path.join(mediaDir, `${stem}.jpg`);
    if (toJpeg(from, jpegDest, 1200)) {
      published.src = `/media/${stem}.jpg`;
      if (ext.match(/\.png$/i) && fs.existsSync(destOriginal)) {
        fs.unlinkSync(destOriginal);
      }
    }
  }

  return published;
}
