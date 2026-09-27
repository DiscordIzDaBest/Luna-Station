#!/usr/bin/env node
/* Luna Station — install the original procedural crew into the frontend.

   Writes, from ONE source (crew.mjs VARIANTS + the catalog below):
     frontend/assets/sprites/<set>/*.png                  every pose, 144x144, feet on y=111
     frontend/assets/sprites/manifest.json                the engine's track manifest (only Luna sets)
     frontend/assets/skin-study-0914/runtime-motion.json  the selected-catalog descriptor the tests + preview read

   The in-code catalog (DATA.SKINS in frontend/app/data-shim.js) mirrors CATALOG below; the tests pin the two
   together. Re-run after changing crew.mjs:  node scripts/luna-art/install-crew.mjs */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VARIANTS, renderSet } from './crew.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const SPRITES = join(ROOT, 'frontend', 'assets', 'sprites');
const STUDY = join(ROOT, 'frontend', 'assets', 'skin-study-0914');

// skin id (what a save stores) -> sprite set. Ids that existed before keep working for old saves.
export const CATALOG = [
  ['blank', 'luna_cadet'], ['astronaut', 'luna_tide'], ['robot', 'luna_bot'], ['crthead', 'luna_bot_frost'],
  ['alien', 'luna_aurora'], ['ultron', 'luna_overseer'], ['skeleton', 'luna_graphite'], ['plaguedoctor', 'luna_eclipse'],
  ['secretagent', 'luna_shadow'], ['voidwizard', 'luna_nebula'], ['crewmate', 'luna_signal'], ['bear', 'luna_regolith'],
  ['capybara', 'luna_terra'], ['station_minion', 'luna_medic'], ['blank_blue', 'luna_mare'], ['blank_green', 'luna_scout'],
  ['blank_red', 'luna_bot_ember'], ['blank_amber', 'luna_sol'], ['nova', 'luna_nova'], ['quartz', 'luna_quartz'],
  ['cobalt', 'luna_cobalt_bot'], ['blossom', 'luna_blossom'], ['moss', 'luna_moss_bot'], ['ice', 'luna_ice']
];

if (process.argv[1] && /[\\/]install-crew\.mjs$/.test(process.argv[1])) {
  const bySet = new Map(VARIANTS.map(v => [v[0], v]));
  for (const [, set] of CATALOG) if (!bySet.has(set)) throw new Error('catalog names an unknown set: ' + set);
  const manifest = {};
  for (const [, set] of CATALOG) {
    rmSync(join(SPRITES, set), { recursive: true, force: true });
    Object.assign(manifest, renderSet(bySet.get(set), SPRITES).manifest);
  }
  writeFileSync(join(SPRITES, 'manifest.json'), JSON.stringify({ sprites: manifest }, null, 2) + '\n');
  mkdirSync(STUDY, { recursive: true });
  const skins = CATALOG.map(([skin, set]) => ({
    id: set.replace(/^luna_/, ''), skin, name: bySet.get(set)[1], stage: 'complete', targetStandingHeight: 19,
    walkFramesReady: true, walkReady: true, complete: true, retainedOriginal: false, sourceStandingHeight: 76,
    readyForStation: true, renderSet: set, motionSource: 'luna-procedural', style: 'Original Luna Station procedural pixel crew'
  }));
  writeFileSync(join(STUDY, 'runtime-motion.json'), JSON.stringify({ standingHeight: 19, skins, sprites: manifest }) + '\n');
  console.log('installed ' + CATALOG.length + ' Luna crew sets (' + Object.values(manifest).flat().length + ' frames)');
}
