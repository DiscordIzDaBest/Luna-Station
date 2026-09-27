/* LUNA STATION — data-shim.js
   The reused v7 sprite engine (js/assets.js) recolors a body by looking up
   DATA.AGENT[id].color. v7 shipped a giant 17-agent roster (data.js); the real
   harness has no fixed roster — each user-created agent registers itself here.
   This is the ONLY thing assets.js needs from the old data layer. */
'use strict';

const DATA = { AGENT: {} };

/* register (or recolor) an agent so the sprite engine can tint its suit */
function registerAgent(id, color) {
  DATA.AGENT[id] = { id, color: color || '#5ad0ff' };
  return DATA.AGENT[id];
}

/* SKIN REGISTRY — each agent picks a skin (a natively-colored sprite set) at
   creation. assets.js drawBody maps agent.skin -> DATA.SKINS[skin].set -> the
   manifest's "<set>.<state>.<dir>" frames. ADDITIVE: new skins = new entries
   here + a matching sprite set in assets/sprites/manifest.json. `scale` is the
   per-set downscale applied at tint time (crew sprites render on a 92px canvas). */
DATA.SKINS = {
  blank: {"name":"Lunar Cadet","set":"luna_cadet","scale":0.25,"sourceStandingHeight":76},
  astronaut: {"name":"Tide Engineer","set":"luna_tide","scale":0.25,"sourceStandingHeight":76},
  robot: {"name":"Station Bot","set":"luna_bot","scale":0.25,"sourceStandingHeight":76},
  crthead: {"name":"Frost Bot","set":"luna_bot_frost","scale":0.25,"sourceStandingHeight":76},
  alien: {"name":"Aurora","set":"luna_aurora","scale":0.25,"sourceStandingHeight":76},
  ultron: {"name":"Station Overseer","set":"luna_overseer","scale":0.25,"sourceStandingHeight":76},
  skeleton: {"name":"Graphite","set":"luna_graphite","scale":0.25,"sourceStandingHeight":76},
  plaguedoctor: {"name":"Eclipse","set":"luna_eclipse","scale":0.25,"sourceStandingHeight":76},
  secretagent: {"name":"Night Shift","set":"luna_shadow","scale":0.25,"sourceStandingHeight":76},
  voidwizard: {"name":"Nebula","set":"luna_nebula","scale":0.25,"sourceStandingHeight":76},
  crewmate: {"name":"Signal Officer","set":"luna_signal","scale":0.25,"sourceStandingHeight":76},
  bear: {"name":"Regolith","set":"luna_regolith","scale":0.25,"sourceStandingHeight":76},
  capybara: {"name":"Terraformer","set":"luna_terra","scale":0.25,"sourceStandingHeight":76},
  station_minion: {"name":"Crater Medic","set":"luna_medic","scale":0.25,"sourceStandingHeight":76},
  blank_blue: {"name":"Mare Blue","set":"luna_mare","scale":0.25,"sourceStandingHeight":76},
  blank_green: {"name":"Orbit Scout","set":"luna_scout","scale":0.25,"sourceStandingHeight":76},
  blank_red: {"name":"Ember Bot","set":"luna_bot_ember","scale":0.25,"sourceStandingHeight":76},
  blank_amber: {"name":"Solar Tech","set":"luna_sol","scale":0.25,"sourceStandingHeight":76},
  nova: {"name":"Nova","set":"luna_nova","scale":0.25,"sourceStandingHeight":76},
  quartz: {"name":"Quartz","set":"luna_quartz","scale":0.25,"sourceStandingHeight":76},
  cobalt: {"name":"Cobalt Bot","set":"luna_cobalt_bot","scale":0.25,"sourceStandingHeight":76},
  blossom: {"name":"Blossom","set":"luna_blossom","scale":0.25,"sourceStandingHeight":76},
  moss: {"name":"Moss Bot","set":"luna_moss_bot","scale":0.25,"sourceStandingHeight":76},
  ice: {"name":"Ice Runner","set":"luna_ice","scale":0.25,"sourceStandingHeight":76},
};
// Saves made before the Luna Station crew existed can name skins that are no longer offered (the upstream roster
// included third-party characters and real people, which this build does not ship). Keep those ids READABLE —
// non-enumerable, so the picker never offers them — mapped onto an original Luna set, so an old agent still renders.
[['xenomorph', 'luna_aurora'], ['robocop', 'luna_bot'], ['masterchief', 'luna_scout'], ['pepe', 'luna_scout'], ['vaultboy', 'luna_mare'], ['heisenberg', 'luna_graphite'], ['endoskeleton', 'luna_graphite'], ['ultrondroid', 'luna_overseer'], ['samaltman', 'luna_cadet'], ['dario', 'luna_cadet'], ['freddyfazbear', 'luna_regolith'], ['ghostface', 'luna_shadow'], ['morpheus', 'luna_shadow'], ['ricksanchez', 'luna_ice'], ['ninjaturtle', 'luna_scout'], ['pikachu', 'luna_sol'], ['caseyjones', 'luna_graphite'], ['finn', 'luna_ice'], ['grimreaper', 'luna_shadow'], ['minionchar', 'luna_medic']].forEach(([id, set]) => {
  const base = Object.values(DATA.SKINS).find(s => s.set === set);
  Object.defineProperty(DATA.SKINS, id, { value: base });
});
DATA.DEFAULT_SKIN = 'blank';
