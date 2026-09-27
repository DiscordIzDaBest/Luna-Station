#!/usr/bin/env node
/* Luna Station — original procedural crew sprites.
   Draws every crew pose on a 72x72 logical pixel grid and writes it at 2x (144x144) in the exact layout the
   sprite engine (frontend/js/assets.js) already consumes: rot_<dir8>, walk_<dir8>_1..8, sit_<dir4>_4,
   type_north_1..4. Feet land on y=111 and the standing figure is 76px tall, matching the geometry the
   engine's foot-pad measurement and `sourceStandingHeight: 76` assume.

   usage: node scripts/luna-art/crew.mjs <outDir>   (writes <outDir>/<set>/*.png and prints manifest entries as JSON) */
import { createCanvas } from '@napi-rs/canvas';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const G = 72, SCALE = 2;
const DIR8 = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const DIR4 = ['south', 'east', 'north', 'west'];

// ---------- palettes: [id, display name, head, suit, suitShade, suitLight, accent, trim] ----------
export const VARIANTS = [
  ['luna_cadet',     'Lunar Cadet',     'helmet', '#c9d3e0', '#8e9bb0', '#eef3fa', '#5fe3ff', '#3b4a63'],
  ['luna_tide',      'Tide Engineer',   'helmet', '#f08a3c', '#b85a1f', '#ffc08a', '#7ff5ff', '#4a2a18'],
  ['luna_eclipse',   'Eclipse',         'dome',   '#5b4a8c', '#382c5e', '#8f7cc8', '#ffd35c', '#1f1836'],
  ['luna_regolith',  'Regolith',        'helmet', '#cbb58f', '#94805d', '#eadcbf', '#ff7f5c', '#4b3f2c'],
  ['luna_medic',     'Crater Medic',    'dome',   '#eef1f4', '#b3bcc6', '#ffffff', '#ff5a6e', '#44505e'],
  ['luna_scout',     'Orbit Scout',     'helmet', '#5fae6e', '#3a7a47', '#9be0a6', '#e9ff6a', '#1e3a25'],
  ['luna_mare',      'Mare Blue',       'helmet', '#3f7fd6', '#2a5496', '#8ab8f5', '#ffe07a', '#18284a'],
  ['luna_nova',      'Nova',            'dome',   '#ffcf4d', '#c9951e', '#fff0b0', '#ff5cd6', '#4d3a10'],
  ['luna_bot',       'Station Bot',     'bot',    '#9aa6b8', '#667286', '#d3dbe6', '#63ffb3', '#2b3342'],
  ['luna_bot_ember', 'Ember Bot',       'bot',    '#b8584a', '#7e342b', '#e88f7f', '#ffd166', '#3a1813'],
  ['luna_bot_frost', 'Frost Bot',       'bot',    '#dfeaf2', '#9fb4c4', '#ffffff', '#6ad7ff', '#3a4b5a'],
  ['luna_shadow',    'Night Shift',     'dome',   '#343b4f', '#20263a', '#58627e', '#b98cff', '#0c0f19'],
  ['luna_overseer',  'Station Overseer','bot',    '#2f3a52', '#1c2436', '#51607f', '#ff4d6d', '#0b0f1a'],
  ['luna_signal',    'Signal Officer',  'helmet', '#e2574c', '#a3362e', '#ff9a8f', '#ffffff', '#3d1512'],
  ['luna_quartz',    'Quartz',          'dome',   '#d8c7f0', '#a08cc2', '#f3ebff', '#6af0c8', '#3a2f52'],
  ['luna_terra',     'Terraformer',     'helmet', '#7a8f3c', '#52632a', '#b3c76a', '#ff9f43', '#262e12'],
  ['luna_aurora',    'Aurora',          'dome',   '#2fb3a1', '#1d7a6d', '#79e6d6', '#ff7ae0', '#0f3530'],
  ['luna_cobalt_bot','Cobalt Bot',      'bot',    '#3b5bdb', '#2640a0', '#8aa2ff', '#ffe66d', '#131f4d'],
  ['luna_sol',       'Solar Tech',      'helmet', '#f4a300', '#b77400', '#ffd36b', '#4dd2ff', '#4a2f00'],
  ['luna_graphite',  'Graphite',        'helmet', '#5d6470', '#3d434c', '#8c94a1', '#9dff6a', '#15181d'],
  ['luna_blossom',   'Blossom',         'dome',   '#f28bb3', '#b85a80', '#ffc2da', '#8ef9ff', '#4a1d30'],
  ['luna_moss_bot',  'Moss Bot',        'bot',    '#6c8a4b', '#465c30', '#a3c27f', '#fff27a', '#1f2a13'],
  ['luna_nebula',    'Nebula',          'dome',   '#7b3fa0', '#52296c', '#b57ad6', '#62f0ff', '#240f33'],
  ['luna_ice',       'Ice Runner',      'helmet', '#a9e4f5', '#6fb0c6', '#e6faff', '#ff6b6b', '#23424e']
];

function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 255]; }
function mix(a, b, t) { const A = hex(a), B = hex(b); return '#' + [0, 1, 2].map(i => Math.round(A[i] + (B[i] - A[i]) * t).toString(16).padStart(2, '0')).join(''); }

class Grid {
  constructor() { this.px = new Array(G * G).fill(null); }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < G && y < G && c) this.px[y * G + x] = c; }
  get(x, y) { return (x >= 0 && y >= 0 && x < G && y < G) ? this.px[y * G + x] : null; }
  rect(x0, y0, w, h, c) { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) this.set(x, y, typeof c === 'function' ? c(x - x0, y - y0, w, h) : c); }
  disc(cx, cy, r, c) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const dx = x - cx, dy = y - cy;
        if (dx * dx + dy * dy <= r * r + 0.3) this.set(x, y, typeof c === 'function' ? c(dx, dy) : c);
      }
  }
  outline(color) {
    const add = [];
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      if (this.get(x, y)) continue;
      if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
    }
    for (const [x, y] of add) this.set(x, y, color);
  }
  mirror() { const g = new Grid(); for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) g.px[y * G + (G - 1 - x)] = this.px[y * G + x]; return g; }
  toCanvas() {
    const c = createCanvas(G * SCALE, G * SCALE), ctx = c.getContext('2d');
    for (let y = 0; y < G; y++) for (let x = 0; x < G; x++) {
      const p = this.px[y * G + x]; if (!p) continue;
      ctx.fillStyle = p; ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
    }
    return c;
  }
}

// shaded vertical slab: light on the left edge, shade on the right third (key light from the upper left)
function slab(P, x0, w) {
  return (x) => x === 0 ? P.light : (x >= Math.ceil(w * 0.68) ? P.shade : P.suit);
}

/* view: 'front' | 'front3' | 'side' | 'back3' | 'back' (all drawn facing right where it matters; west = mirror)
   pose: { walk:0..1 phase | null, sit:bool, type:0..3 | null } */
function drawFigure(P, head, view, pose) {
  const g = new Grid();
  const sit = !!pose.sit;
  const ph = pose.walk == null ? null : pose.walk * Math.PI * 2;
  const bob = ph == null ? 0 : -Math.round(Math.abs(Math.cos(ph)) * 1);   // rise on passing positions
  const drop = sit ? 3 : 0;
  const cx = 36;
  const top = 19 + drop + bob;                 // helmet top (outline row 18 → 76px standing height at 2x)
  const hy = top + 5;                           // head centre
  const torsoY = top + 12, torsoH = 12;
  const hipY = torsoY + torsoH;                 // 42 standing
  const footY = 54;                            // last body row; its outline lands on y=55 → px 110-111
  const narrow = view === 'side' ? 8 : (view === 'front3' || view === 'back3') ? 9 : 11;
  const tx = cx - Math.floor(narrow / 2);
  const facingBack = view === 'back' || view === 'back3';

  // ---- backpack (behind the body, visible from back and side) ----
  if (view === 'side') { g.rect(tx - 3, torsoY + 1, 3, 9, P.trim); g.rect(tx - 2, torsoY + 2, 1, 2, P.accent); }
  if (view === 'front3') g.rect(tx - 2, torsoY + 1, 2, 8, P.trim);

  // ---- legs ----
  function leg(x, lift, lean, len, far) {
    const base = far ? P.shade : P.suit, lite = far ? P.suit : P.light, dark = far ? mix(P.shade, '#000000', 0.25) : P.shade;
    for (let i = 0; i < len; i++) {
      const y = hipY + i - lift;
      const dx = Math.round(lean * (i / Math.max(1, len - 1)));
      const boot = i >= len - 3;
      for (let k = 0; k < 4; k++) g.set(x + k + dx, y, boot ? (k === 3 ? '#1b2130' : far ? '#232a3a' : '#2c3446') : (k === 3 ? dark : k === 0 ? lite : base));
    }
  }
  const legLen = footY - hipY + 1;
  if (sit) {
    if (view === 'side') {
      // thigh forward, shin down (facing right)
      g.rect(cx - 2, hipY, 9, 4, (x, y) => y === 0 ? P.light : y === 3 ? P.shade : P.suit);
      g.rect(cx + 5, hipY + 4, 4, footY - (hipY + 4) - 2, (x) => x === 3 ? P.shade : P.suit);
      g.rect(cx + 5, footY - 2, 5, 3, '#2c3446');
    } else if (view === 'back' || view === 'back3') {
      // seen from behind while seated: the lower legs show under the seat, darker, down to the floor line
      leg(cx - 5, 0, 0, legLen, true);
      leg(cx + 1, 0, 0, legLen, true);
    } else {
      // knees toward the viewer: legs slightly splayed, feet planted on the same floor line as standing
      leg(cx - 5, 0, -1, legLen);
      leg(cx + 1, 0, 1, legLen);
    }
  } else if (view === 'side') {
    const s = ph == null ? 0 : Math.sin(ph) * 3;
    leg(cx - 3, 0, -s, legLen, true);                  // far leg first, darker, one pixel behind
    leg(cx - 1, ph == null ? 0 : Math.round(Math.max(0, Math.cos(ph))), s, legLen, false);
  } else {
    const lift = ph == null ? [0, 0] : [Math.max(0, Math.sin(ph)) * 2, Math.max(0, -Math.sin(ph)) * 2];
    const spread = view === 'front3' || view === 'back3' ? 0 : 0;
    leg(cx - 5 + spread, Math.round(lift[0]), 0, legLen - Math.round(lift[0]) + Math.round(lift[0]));
    leg(cx + 1 - spread, Math.round(lift[1]), 0, legLen);
  }

  // ---- torso ----
  g.rect(tx, torsoY, narrow, torsoH, slab(P, 0, narrow));
  g.rect(tx, hipY - 2, narrow, 2, P.trim);                               // belt
  if (!facingBack && view !== 'side') {                                   // chest crescent emblem
    const ex = view === 'front3' ? cx + 1 : cx, ey = torsoY + 4;
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) {
      const inA = x * x + y * y <= 5.2, inB = (x - 1.2) ** 2 + (y + 0.4) ** 2 <= 3.2;
      if (inA && !inB) g.set(ex + x, ey + y, P.accent);
    }
  }
  if (facingBack) {                                                        // backpack from behind
    const bw = narrow - 3, bx = tx + 1 + (view === 'back3' ? -1 : 0);
    g.rect(bx, torsoY + 1, bw, 9, (x, y) => y === 0 ? P.light : x === bw - 1 ? P.trim : P.shade);
    g.rect(bx + Math.floor(bw / 2) - 1, torsoY + 3, 2, 2, P.accent);
  }

  // ---- arms ----
  function arm(x, swing, len, w) {
    for (let i = 0; i < len; i++) {
      const dx = Math.round(swing * (i / Math.max(1, len - 1)));
      const glove = i >= len - 2;
      for (let k = 0; k < w; k++) g.set(x + k + dx, torsoY + 1 + i, glove ? P.trim : (k === w - 1 || k === 0 && x > cx ? P.shade : P.suit));
    }
  }
  if (pose.type != null) {
    // seated at a console, seen from behind: forearms forward, hands tapping alternately
    const t = pose.type;
    const l = (t % 2 === 0) ? 0 : 1, r = (t % 2 === 0) ? 1 : 0;
    g.rect(tx - 2, torsoY + 1, 2, 5, P.shade); g.rect(tx + narrow, torsoY + 1, 2, 5, P.shade);
    g.rect(tx - 1, torsoY + 5 - l, 3, 2, P.trim); g.rect(tx + narrow - 2, torsoY + 5 - r, 3, 2, P.trim);
  } else if (view === 'side') {
    const s = ph == null ? 0 : -Math.sin(ph) * 3;
    arm(cx - 1, sit ? 3 : s, sit ? 8 : 11, 3);
  } else {
    const s = ph == null ? 0 : Math.sin(ph);
    const aw = 3;
    const lLen = 11 + (ph == null ? 0 : Math.round(-s)), rLen = 11 + (ph == null ? 0 : Math.round(s));
    arm(tx - aw, 0, sit ? 9 : lLen, aw);
    arm(tx + narrow, 0, sit ? 9 : rLen, aw);
  }

  // ---- neck ring ----
  g.rect(cx - 3, torsoY - 1, 7, 1, P.trim);

  // ---- head ----
  if (head === 'bot') {
    const hw = view === 'side' ? 9 : 11, hx = cx - Math.floor(hw / 2);
    g.rect(hx, top, hw, 10, (x, y) => y === 0 || x === 0 ? P.light : x >= hw - 2 ? P.shade : P.suit);
    g.set(cx, top - 1, P.trim); g.set(cx, top - 2, P.accent);           // antenna
    if (!facingBack) {
      const ex = view === 'side' ? cx + 1 : view === 'front3' ? cx - 2 : cx - 4;
      const ew = view === 'side' ? 4 : view === 'front3' ? 7 : 9;
      g.rect(ex, top + 3, ew, 3, '#0d1420');
      for (let x = 1; x < ew - 1; x++) g.set(ex + x, top + 4, P.accent);
    } else {
      g.rect(cx - 2, top + 3, 5, 3, P.trim);
    }
  } else {
    const r = 5.6;
    g.disc(cx, hy, r, (dx, dy) => (dx + dy < -4 ? P.light : dx + dy > 3.5 ? P.shade : P.suit));
    if (head === 'dome') { g.set(cx, top - 1, P.trim); g.set(cx, top - 2, P.accent); }
    if (!facingBack) {
      // visor: dark glass with an accent rim-glow and a single specular pixel
      const vx = view === 'side' ? cx + 1 : view === 'front3' ? cx - 2 : cx - 4;
      const vw = view === 'side' ? 5 : view === 'front3' ? 7 : 9;
      for (let y = 0; y < 5; y++) for (let x = 0; x < vw; x++) {
        const corner = (y === 0 || y === 4) && (x === 0 || x === vw - 1);
        if (corner) continue;
        g.set(vx + x, hy - 2 + y, y === 4 ? mix('#101826', P.accent, 0.55) : mix('#0b1220', '#22324d', y / 4));
      }
      g.set(vx + 1, hy - 1, '#ffffff'); g.set(vx + 2, hy - 1, mix('#ffffff', P.accent, 0.5));
    } else {
      g.rect(cx - 3, hy + 2, 7, 1, P.shade);
    }
  }

  g.outline('#0a0d16');
  return g;
}

function viewFor(dir) {
  switch (dir) {
    case 'south': return ['front', false];
    case 'south-east': return ['front3', false];
    case 'east': return ['side', false];
    case 'north-east': return ['back3', false];
    case 'north': return ['back', false];
    case 'north-west': return ['back3', true];
    case 'west': return ['side', true];
    case 'south-west': return ['front3', true];
  }
}

export function renderSet(variant, outRoot) {
  const [id, name, head, suit, shade, light, accent, trim] = variant;
  const P = { suit, shade, light, accent, trim };
  const dir = join(outRoot, id);
  mkdirSync(dir, { recursive: true });
  const manifest = {};
  const put = (file, grid) => writeFileSync(join(dir, file), grid.toCanvas().toBuffer('image/png'));
  for (const d of DIR8) {
    const [view, flip] = viewFor(d);
    const fig = (pose) => { const g = drawFigure(P, head, view, pose); return flip ? g.mirror() : g; };
    put('rot_' + d + '.png', fig({}));
    manifest[id + '.rot.' + d] = [id + '/rot_' + d + '.png'];
    const walk = [];
    for (let f = 1; f <= 8; f++) { put('walk_' + d + '_' + f + '.png', fig({ walk: (f - 1) / 8 })); walk.push(id + '/walk_' + d + '_' + f + '.png'); }
    manifest[id + '.walk.' + d] = walk;
  }
  for (const d of DIR4) {
    const [view, flip] = viewFor(d);
    let g = drawFigure(P, head, view, { sit: true }); if (flip) g = g.mirror();
    put('sit_' + d + '_4.png', g);
    manifest[id + '.sit.' + d] = [id + '/sit_' + d + '_4.png'];
  }
  const type = [];
  for (let t = 1; t <= 4; t++) { put('type_north_' + t + '.png', drawFigure(P, head, 'back', { sit: true, type: t - 1 })); type.push(id + '/type_north_' + t + '.png'); }
  manifest[id + '.type.north'] = type;
  return { id, name, manifest };
}

if (process.argv[1] && /[\\/]crew\.mjs$/.test(process.argv[1])) {
  const out = process.argv[2];
  if (!out) { console.error('usage: node scripts/luna-art/crew.mjs <outDir>'); process.exit(1); }
  const all = VARIANTS.map(v => renderSet(v, out));
  process.stdout.write(JSON.stringify(all.map(a => ({ id: a.id, name: a.name })), null, 1) + '\n');
  writeFileSync(join(out, '_luna-manifest.json'), JSON.stringify(Object.assign({}, ...all.map(a => a.manifest)), null, 1));
}
