#!/usr/bin/env node
/* Luna Station — original brand art, generated procedurally so it can be re-rendered or re-coloured later.
   Emblem: a pixel crescent moon inside a tilted orbital ring, with a small docked station module on the ring.
   usage: node scripts/luna-art/brand.mjs <outDir>
   writes: icon-1024.png (app icon source), emblem-256.png, favicon-64.png, wordmark.svg, logo-lockup.png,
           installer-header.bmp (150x57), installer-sidebar.bmp (164x314), dmg-background.png (660x400) */
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const BRAND = {
  name: 'Luna Station',
  bg0: '#070a14', bg1: '#111a33',
  moon: '#e9e4d4', moonShade: '#b9b29c', moonDeep: '#8a846f', crater: '#a39d86',
  ring: '#5fe3ff', ringShade: '#2a8fb3', module: '#c9d3e0', moduleShade: '#6f7d95', light: '#ffd35c',
  star: '#dfe8ff', ink: '#050810'
};

// ---- the emblem on a 64x64 logical grid ----
function emblemGrid(withBg) {
  const N = 64, px = new Array(N * N).fill(null);
  const set = (x, y, c) => { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < N && y < N) px[y * N + x] = c; };
  const get = (x, y) => (x >= 0 && y >= 0 && x < N && y < N) ? px[y * N + x] : null;
  const B = BRAND;
  if (withBg) {
    // rounded-square plate with a vertical gradient and a hand-placed star field
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const r = 9, cx = Math.min(Math.max(x, r), N - 1 - r), cy = Math.min(Math.max(y, r), N - 1 - r);
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const t = y / N + (((x + y) & 1) ? 0.03 : -0.03);   // 2-tone ordered dither between bands
      set(x, y, t < 0.3 ? B.bg0 : t < 0.55 ? '#090f1e' : t < 0.8 ? '#0b1224' : B.bg1);
    }
    for (const [x, y, big] of [[9, 12, 1], [52, 9, 0], [56, 22, 1], [7, 44, 0], [13, 54, 0], [49, 55, 1], [30, 6, 0], [58, 40, 0]]) {
      set(x, y, B.star); if (big) { set(x - 1, y, '#7f8db0'); set(x + 1, y, '#7f8db0'); set(x, y - 1, '#7f8db0'); set(x, y + 1, '#7f8db0'); }
    }
  }
  const mx = 30, my = 32, R = 17;
  // back half of the orbital ring (behind the moon)
  const ring = (front) => {
    for (let a = 0; a < Math.PI * 2; a += 0.004) {
      const ex = Math.cos(a) * 27, ey = Math.sin(a) * 8.5;
      const rx = ex * Math.cos(-0.38) - ey * Math.sin(-0.38), ry = ex * Math.sin(-0.38) + ey * Math.cos(-0.38);
      const isFront = Math.sin(a) > 0;
      if (isFront !== front) continue;
      set(mx + 1 + rx, my + ry, front ? B.ring : B.ringShade);
      set(mx + 1 + rx, my + ry + 1, front ? B.ringShade : '#1b5570');
    }
  };
  ring(false);
  // crescent: full disc minus an offset disc, shaded, with craters
  for (let y = -R; y <= R; y++) for (let x = -R; x <= R; x++) {
    if (x * x + y * y > R * R + 0.5) continue;
    const bx = x - 9, by = y + 4;
    if (bx * bx + by * by <= 14.2 ** 2) continue;          // the bite that makes the crescent
    const lit = Math.sqrt(bx * bx + by * by) - 14.2 - x * 0.35;   // brightest along the outer limb
    set(mx + x, my + y, lit > 7 ? B.moon : lit > 2.5 ? B.moonShade : B.moonDeep);
  }
  for (const [cx, cy, r] of [[-11, 1, 2.2], [-6, 9, 1.6], [-13, 8, 1.2], [-2, 13, 1.3], [-9, -6, 1]]) {
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= r * r && get(mx + cx + x, my + cy + y)) set(mx + cx + x, my + cy + y, (x + y > 0) ? B.moon : B.crater);
  }
  ring(true);
  // docked station module riding the front of the ring
  const sx = 39, sy = 34;
  for (let y = 0; y < 5; y++) for (let x = 0; x < 8; x++) set(sx + x, sy + y, y === 0 ? '#ffffff' : x > 5 ? B.moduleShade : B.module);
  for (let x = -4; x < 0; x++) { set(sx + x, sy + 2, B.ringShade); set(sx + 8 - x + 3, sy + 2, B.ringShade); }
  for (let y = -1; y < 6; y++) { set(sx - 5, sy + y, '#3a6fd8'); set(sx - 6, sy + y, '#2a4f9e'); set(sx + 12, sy + y, '#3a6fd8'); set(sx + 13, sy + y, '#2a4f9e'); }
  set(sx + 3, sy + 2, B.light); set(sx + 4, sy + 2, B.light);
  // outline everything that is not background
  const isFg = (c) => c && ![B.bg0, '#090f1e', '#0b1224', B.bg1, B.star, '#7f8db0'].includes(c);
  const add = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (isFg(get(x, y))) continue;
    if (isFg(get(x - 1, y)) || isFg(get(x + 1, y)) || isFg(get(x, y - 1)) || isFg(get(x, y + 1))) add.push([x, y]);
  }
  for (const [x, y] of add) if (get(x, y) || !withBg) set(x, y, B.ink);
  return { N, px };
}

function paint(grid, size) {
  const c = createCanvas(size, size), ctx = c.getContext('2d'), s = size / grid.N;
  for (let y = 0; y < grid.N; y++) for (let x = 0; x < grid.N; x++) {
    const p = grid.px[y * grid.N + x]; if (!p) continue;
    ctx.fillStyle = p; ctx.fillRect(Math.floor(x * s), Math.floor(y * s), Math.ceil(s), Math.ceil(s));
  }
  return c;
}

// ---- 5x7 pixel font for the wordmark (original glyph drawings, only the letters we need) ----
const FONT = {
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  ' ': ['000', '000', '000', '000', '000', '000', '000']
};
function wordCells(text) {
  const cells = []; let x = 0;
  for (const ch of text.toUpperCase()) {
    const g = FONT[ch] || FONT[' '];
    g.forEach((row, y) => [...row].forEach((b, i) => { if (b === '1') cells.push([x + i, y]); }));
    x += g[0].length + 1;
  }
  return { cells, w: x - 1, h: 7 };
}
// One <path> filled with currentColor: the topbar paints it through a CSS MASK (alpha only), and an XML-strict
// single-path SVG is what that loader accepts (see test/brand-wordmark-mask.test.js). viewBox = the pixel grid.
export function wordmarkSvg(text) {
  const { cells, w, h } = wordCells(text);
  const d = cells.map(([x, y]) => 'M' + x + ' ' + y + 'h1v1h-1z').join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges" role="img" aria-label="' + text + '">'
    + '<title>' + text + '</title><path fill="currentColor" d="' + d + '"/></svg>\n';
}
function drawWord(ctx, text, x0, y0, cell, color, shadow) {
  const { cells } = wordCells(text);
  if (shadow) { ctx.fillStyle = shadow; for (const [x, y] of cells) ctx.fillRect(x0 + x * cell + Math.max(1, cell / 4), y0 + y * cell + Math.max(1, cell / 4), cell, cell); }
  ctx.fillStyle = color; for (const [x, y] of cells) ctx.fillRect(x0 + x * cell, y0 + y * cell, cell, cell);
  return wordCells(text).w * cell;
}

// Uncompressed 24-bit BMP writer (NSIS header/sidebar images must be BMP).
function bmp(canvas) {
  const w = canvas.width, h = canvas.height, d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const row = Math.ceil(w * 3 / 4) * 4, size = 54 + row * h, b = Buffer.alloc(size);
  b.write('BM', 0); b.writeUInt32LE(size, 2); b.writeUInt32LE(54, 10); b.writeUInt32LE(40, 14);
  b.writeInt32LE(w, 18); b.writeInt32LE(h, 22); b.writeUInt16LE(1, 26); b.writeUInt16LE(24, 28); b.writeUInt32LE(row * h, 34);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = ((h - 1 - y) * w + x) * 4, o = 54 + y * row + x * 3;
    b[o] = d[s + 2]; b[o + 1] = d[s + 1]; b[o + 2] = d[s];
  }
  return b;
}
function spaceBg(ctx, w, h) {
  const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, BRAND.bg0); g.addColorStop(1, BRAND.bg1);
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < (w * h) / 900; i++) { ctx.fillStyle = rnd() > 0.8 ? '#ffffff' : '#6f7fa8'; ctx.fillRect(Math.floor(rnd() * w), Math.floor(rnd() * h), 1, 1); }
}

if (process.argv[1] && /[\\/]brand\.mjs$/.test(process.argv[1])) {
  const out = process.argv[2]; if (!out) { console.error('usage: node scripts/luna-art/brand.mjs <outDir>'); process.exit(1); }
  mkdirSync(out, { recursive: true });
  const plate = emblemGrid(true), bare = emblemGrid(false);
  writeFileSync(join(out, 'icon-1024.png'), paint(plate, 1024).toBuffer('image/png'));
  writeFileSync(join(out, 'emblem-256.png'), paint(bare, 256).toBuffer('image/png'));
  writeFileSync(join(out, 'favicon-64.png'), paint(plate, 64).toBuffer('image/png'));
  writeFileSync(join(out, 'wordmark.svg'), wordmarkSvg(BRAND.name));
  // logo lockup: emblem + wordmark, transparent background
  {
    const c = createCanvas(1180, 260), x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(paint(bare, 256), 0, 2);
    const ww = drawWord(x, BRAND.name, 290, 86, 12, '#e9f3ff', '#1b5570');
    x.fillStyle = BRAND.ring; x.fillRect(290, 190, ww, 6);
    writeFileSync(join(out, 'logo-lockup.png'), c.toBuffer('image/png'));
  }
  // splash / title-screen logo: emblem stacked over the wordmark, transparent background
  {
    const c = createCanvas(960, 560), x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(paint(bare, 320), 320, 0);
    const cell = 12, w = wordCells(BRAND.name).w * cell;
    drawWord(x, BRAND.name, Math.round((960 - w) / 2), 380, cell, '#e9f3ff', '#1b5570');
    x.fillStyle = BRAND.ring; x.fillRect(Math.round((960 - w) / 2), 484, w, 6);
    writeFileSync(join(out, 'splash-logo.png'), c.toBuffer('image/png'));
  }
  // NSIS header 150x57
  {
    const c = createCanvas(150, 57), x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    spaceBg(x, 150, 57); x.drawImage(paint(bare, 48), 98, 4);
    drawWord(x, 'LUNA', 8, 14, 3, '#e9f3ff', '#1b5570'); drawWord(x, 'STATION', 8, 38, 1.5, BRAND.ring, null);
    writeFileSync(join(out, 'installer-header.bmp'), bmp(c));
  }
  // NSIS sidebar 164x314
  {
    const c = createCanvas(164, 314), x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    spaceBg(x, 164, 314); x.drawImage(paint(bare, 128), 18, 40);
    drawWord(x, 'LUNA', 30, 200, 5, '#e9f3ff', '#1b5570'); drawWord(x, 'STATION', 22, 248, 3, BRAND.ring, null);
    writeFileSync(join(out, 'installer-sidebar.bmp'), bmp(c));
  }
  // macOS DMG background 660x400
  {
    const c = createCanvas(660, 400), x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    spaceBg(x, 660, 400); x.globalAlpha = 0.25; x.drawImage(paint(bare, 192), 234, 104); x.globalAlpha = 1;
    drawWord(x, BRAND.name, 150, 30, 5, '#e9f3ff', '#1b5570');
    x.fillStyle = BRAND.ring; for (let i = 0; i < 9; i++) x.fillRect(290 + i * 10, 170, 6, 4);
    writeFileSync(join(out, 'dmg-background.png'), c.toBuffer('image/png'));
  }
  console.log('wrote brand art to ' + out);
}
