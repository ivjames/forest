/* =============================================================================
   LOST IN THE FOREST  —  v2
   A DOS/EGA-era survival text adventure, reborn in the browser.

   You wake lost in a 10x10 stretch of wilderness. Somewhere out there is a
   ranger station — reach it and you're rescued. Somewhere out there is also a
   bear. Thirst, hunger, and the cold of night are all ticking down.

   Systems: procedural terrain (streams, hills, clearings, berry patches, a
   cave, ravines), a day/night cycle with weather and hypothermia, a bear with
   wander/hunt/flee AI, foraging & fishing, random trail events, a dozen
   findable items, three difficulties, scoring with saved high scores, and
   save/resume. No framework, no build step — one state machine, one parser.
   ========================================================================== */

'use strict';

const SIZE = 10;
const DAY_LEN = 8;          // turns of daylight, then DAY_LEN of night
const CYCLE = DAY_LEN * 2;

/* ---- items ---------------------------------------------------------------- */
const ITEMS = {
  rations:  { name: 'trail rations',  glyph: 'r', desc: 'Dense, salty, joyless. Restores hunger.',
              aliases: ['ration', 'rations', 'food', 'jerky', 'bar'] },
  canteen:  { name: 'canteen',        glyph: 'c', desc: 'Carry water for when you\'re far from a stream. Fill it at water.',
              aliases: ['canteen', 'flask', 'bottle'] },
  binocs:   { name: 'binoculars',     glyph: 'b', desc: 'Scan the distance without climbing. "use binoculars".',
              aliases: ['binoculars', 'binocs', 'glasses', 'scope'] },
  firetools:{ name: 'flint & steel',  glyph: 'f', desc: 'Make fire: warmth, a bear-ward, and a rescue signal. "make fire".',
              aliases: ['flint', 'steel', 'firetools', 'fire tools', 'matches', 'lighter'] },
  map:      { name: 'tattered map',   glyph: 'm', desc: 'Marks the ranger station and the lay of the land.',
              aliases: ['map', 'chart'] },
  firstaid: { name: 'first-aid kit',  glyph: '+', desc: 'Patch yourself up. "bandage".',
              aliases: ['first-aid', 'first aid', 'firstaid', 'kit', 'medkit', 'bandage', 'aid'] },
  knife:    { name: 'hunting knife',  glyph: 'k', desc: 'Evens the odds if the bear corners you. Fends off snakes.',
              aliases: ['knife', 'blade'] },
  rope:     { name: 'coil of rope',   glyph: '=', desc: 'Cross ravines and climb safely.',
              aliases: ['rope', 'coil'] },
  compass:  { name: 'brass compass',  glyph: 'o', desc: 'Always shows the bearing to the station in your HUD.',
              aliases: ['compass'] },
  whistle:  { name: 'tin whistle',    glyph: 'h', desc: 'A shrill blast drives the bear off for a while. "blow whistle".',
              aliases: ['whistle', 'horn'] },
  flare:    { name: 'signal flare',   glyph: 'Y', desc: 'Lights the whole sky: reveals the map, and rescues you if near the station. One use.',
              aliases: ['flare', 'signal flare'] },
  blanket:  { name: 'wool blanket',   glyph: 'q', desc: 'Slows the cold at night.',
              aliases: ['blanket', 'wool'] },
  lantern:  { name: 'oil lantern',    glyph: 'i', desc: 'See clearly at night while you carry it.',
              aliases: ['lantern', 'lamp', 'light'] },
  fishline: { name: 'fishing line',   glyph: 'j', desc: 'Fish at water for food. "fish".',
              aliases: ['fishing line', 'fishline', 'line', 'tackle'] },
};

/* ---- terrain -------------------------------------------------------------- */
const TERRAIN = {
  forest:   { glyph: '*', cls: 'tree'    },
  water:    { glyph: '~', cls: 'water'   },
  hill:     { glyph: '^', cls: 'hill'    },
  clearing: { glyph: '"', cls: 'clearing'},
  berry:    { glyph: '%', cls: 'berry'   },
  cave:     { glyph: 'n', cls: 'cave'    },
  ravine:   { glyph: 'V', cls: 'ravine'  },
};

const DIRS = {
  north: { dx: 0, dy: -1 }, south: { dx: 0, dy: 1 },
  east:  { dx: 1, dy: 0 },  west:  { dx: -1, dy: 0 },
};
const DIR_ALIAS = { n:'north', s:'south', e:'east', w:'west',
  north:'north', south:'south', east:'east', west:'west',
  up:'north', down:'south', left:'west', right:'east' };

/* ---- difficulty ----------------------------------------------------------- */
const DIFFS = {
  easy:   { label: 'DAY HIKE',      thirst: 12, hunger: 18, health: 6, warmth: 8,
            bearRange: 2, bearSpeed: 0.55, water: 11, start: ['canteen', 'map'], loot: 11 },
  normal: { label: 'BACKCOUNTRY',   thirst: 9,  hunger: 14, health: 5, warmth: 6,
            bearRange: 3, bearSpeed: 0.70, water: 9,  start: [],              loot: 12 },
  hard:   { label: 'SURVIVALIST',   thirst: 7,  hunger: 12, health: 4, warmth: 5,
            bearRange: 4, bearSpeed: 0.85, water: 7,  start: [],              loot: 9  },
};

const WEATHERS = {
  clear: { label: 'clear',    w: 5 },
  fog:   { label: 'fog',      w: 2 },
  rain:  { label: 'rain',     w: 2 },
  storm: { label: 'storm',    w: 1 },
};

/* ---------------------------------------------------------------------------
   Small helpers
   ------------------------------------------------------------------------- */
const rint = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rint(a.length)];
const key = (x, y) => `${x},${y}`;
const chance = (p) => Math.random() < p;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const inBounds = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function bearing(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const ns = dy < 0 ? 'north' : dy > 0 ? 'south' : '';
  const ew = dx > 0 ? 'east'  : dx < 0 ? 'west'  : '';
  return (ns + ew) || 'right here';
}
const cheby = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));

function weightedWeather() {
  const pool = [];
  for (const [k, v] of Object.entries(WEATHERS)) for (let i = 0; i < v.w; i++) pool.push(k);
  return pick(pool);
}

/* ---------------------------------------------------------------------------
   Module state
   ------------------------------------------------------------------------- */
let S = null;                 // game state
let MODE = 'boot';            // boot | menu | play | over
let soundOn = false;

const SAVE_KEY = 'forest.save.v2';
const BEST_KEY = 'forest.best.v2';

/* ---------------------------------------------------------------------------
   World generation
   ------------------------------------------------------------------------- */
function generate(diffName) {
  const cfg = DIFFS[diffName];
  const terrain = new Map();
  const taken = new Set();
  const setT = (x, y, t) => { terrain.set(key(x, y), t); };
  const freeCell = (avoidTypes) => {
    let x, y, k, guard = 0;
    do {
      x = rint(SIZE); y = rint(SIZE); k = key(x, y); guard++;
    } while ((taken.has(k) || (avoidTypes && avoidTypes.includes(terrain.get(k)))) && guard < 500);
    taken.add(k);
    return { x, y };
  };

  // Stream: a wandering line + a pond.
  let drift = rint(SIZE);
  const horizontal = chance(0.5);
  let waterCells = 0;
  for (let i = 0; i < SIZE && waterCells < cfg.water - 2; i++) {
    const wx = horizontal ? i : clamp(drift, 0, SIZE - 1);
    const wy = horizontal ? clamp(drift, 0, SIZE - 1) : i;
    setT(wx, wy, 'water'); waterCells++;
    if (chance(0.5)) drift += chance(0.5) ? 1 : -1;
  }
  while (waterCells < cfg.water) { const c = freeCell(); setT(c.x, c.y, 'water'); waterCells++; }

  // Scattered terrain features.
  const scatter = (t, n) => { for (let i = 0; i < n; i++) { const c = freeCell(['water']); setT(c.x, c.y, t); } };
  scatter('hill', 4);
  scatter('clearing', 3);
  scatter('berry', 4);
  scatter('ravine', 5);
  const cave = freeCell(['water']); setT(cave.x, cave.y, 'cave');

  // Player, station, bear den — none on ravine/water for a fair start.
  const player = freeCell(['ravine']);
  let station;
  do { station = freeCell(['ravine', 'water']); } while (cheby(station, player) < 3);
  let den;
  do { den = freeCell(); } while (cheby(den, player) < 4 || (den.x === station.x && den.y === station.y));

  // Loot — every core item, then extras, on their own non-ravine cells.
  const loot = new Map();
  const bag = ['rations', 'rations', 'canteen', 'binocs', 'firetools', 'map',
               'firstaid', 'knife', 'rope', 'compass', 'whistle', 'flare',
               'blanket', 'lantern', 'fishline'];
  const placeCount = Math.min(cfg.loot, bag.length);
  for (let i = 0; i < placeCount; i++) {
    const c = freeCell(['ravine']);
    loot.set(key(c.x, c.y), bag[i]);
  }

  const inventory = {};
  for (const id of cfg.start) inventory[id] = (inventory[id] || 0) + 1;
  const canteenWater = inventory.canteen ? 3 : 0;

  return {
    diff: diffName, cfg,
    player, station, bear: { x: den.x, y: den.y }, den,
    bearState: 'wander', bearFleeUntil: -1, bearGlyphUntil: -1,
    terrain, loot,
    inventory, canteenWater,
    visited: new Set([key(player.x, player.y)]),
    mapped: new Set(),        // cells revealed by map/flare
    stationKnown: !!inventory.map,
    stats: { health: cfg.health, thirst: cfg.thirst, hunger: cfg.hunger, warmth: cfg.warmth,
             healthMax: cfg.health, thirstMax: cfg.thirst, hungerMax: cfg.hunger, warmthMax: cfg.warmth },
    turn: 0,
    weather: 'clear', weatherUntil: 6,
    fireCell: null, fireUntil: -1,
    ankle: 0,                 // sprained-ankle timer (extra time cost)
    over: false, won: false, score: 0, ending: '',
  };
}

/* time / environment queries */
const isNight = () => (S.turn % CYCLE) >= DAY_LEN;
const phaseName = () => {
  const t = S.turn % CYCLE;
  if (t === 0) return 'dawn';
  if (t === DAY_LEN) return 'dusk';
  return t < DAY_LEN ? 'day' : 'night';
};
const hasLight = () => !isNight() || S.inventory.lantern > 0 || (S.fireCell === key(S.player.x, S.player.y) && S.turn <= S.fireUntil);
const terrainAt = (x, y) => S.terrain.get(key(x, y)) || 'forest';
const fireOn = () => S.fireCell && S.turn <= S.fireUntil;

/* ---------------------------------------------------------------------------
   Rendering
   ------------------------------------------------------------------------- */
const $ = (id) => document.getElementById(id);
const $log = () => $('log');

function print(html, cls) {
  const p = document.createElement('p');
  if (cls) p.className = cls;
  p.innerHTML = html;
  $log().appendChild(p);
  $log().scrollTop = $log().scrollHeight;
  return p;
}
const rule = () => $log().appendChild(document.createElement('hr'));
const say  = (t) => print(t);
const warn = (t) => { print(t, 'warn'); beep(320, 0.05); };
const bad  = (t) => { print(t, 'bad');  beep(140, 0.14); };
const good = (t) => print(t, 'good');
const hint = (t) => print(t, 'hint');

function renderMap() {
  if (MODE !== 'play' && MODE !== 'over') return;
  const rows = [];
  const seeAll = S.mapped.size >= SIZE * SIZE;
  for (let y = 0; y < SIZE; y++) {
    let row = '';
    for (let x = 0; x < SIZE; x++) {
      const k = key(x, y);
      const known = S.visited.has(k) || S.mapped.has(k);
      let glyph = '*', cls = 'tree';
      if (known) { const t = terrainAt(x, y); glyph = TERRAIN[t].glyph; cls = TERRAIN[t].cls; }
      if (known && S.loot.has(k)) { glyph = ITEMS[S.loot.get(k)].glyph; cls = 'loot'; }
      if (S.stationKnown && x === S.station.x && y === S.station.y) { glyph = 'R'; cls = 'station'; }
      if (fireOn() && k === S.fireCell) { glyph = 'ф'; cls = 'fire'; }
      if (S.turn <= S.bearGlyphUntil && x === S.bear.x && y === S.bear.y) { glyph = 'B'; cls = 'bear'; }
      if (x === S.player.x && y === S.player.y) { glyph = '@'; cls = 'me'; }
      row += `<span class="${cls}">${glyph}</span> `;
    }
    rows.push(row.trimEnd());
  }
  $('map').innerHTML = rows.join('\n');
}

function bar(val, max, ch) {
  const n = clamp(Math.round((val / max) * 8), 0, 8);
  return ch.repeat(n) + '·'.repeat(8 - n);
}
function statCls(v, max) {
  const r = v / max;
  return r <= 0.2 ? 'bad' : r <= 0.45 ? 'warn' : 'good';
}

function renderStats() {
  if (MODE !== 'play' && MODE !== 'over') return;
  const st = S.stats;
  const night = isNight();
  let out =
    `HEALTH <span class="${statCls(st.health, st.healthMax)}">${bar(st.health, st.healthMax, '#')}</span>\n` +
    `THIRST <span class="${statCls(st.thirst, st.thirstMax)}">${bar(st.thirst, st.thirstMax, '=')}</span>\n` +
    `HUNGER <span class="${statCls(st.hunger, st.hungerMax)}">${bar(st.hunger, st.hungerMax, '=')}</span>\n`;
  if (night) out += `WARMTH <span class="${statCls(st.warmth, st.warmthMax)}">${bar(st.warmth, st.warmthMax, '=')}</span>\n`;
  else       out += `WARMTH <span class="dim">${bar(st.warmth, st.warmthMax, '=')}</span>\n`;
  $('stats').innerHTML = out.trimEnd();

  const wIcon = { clear: '·', fog: '≈', rain: '\'', storm: '§' }[S.weather] || '·';
  let env = `TURN ${String(S.turn).padStart(3, '0')}  <span class="${night ? 'night' : 'dim'}">${phaseName().toUpperCase()}</span>\n` +
            `SKY  <span class="dim">${S.weather} ${wIcon}</span>`;
  if (S.inventory.compass > 0) {
    const b = bearing(S.player, S.station);
    env += `\nSTN  <span class="station">${b === 'right here' ? 'HERE' : b} ${cheby(S.player, S.station)}</span>`;
  }
  $('env').innerHTML = env;
}

function renderPack() {
  if (MODE !== 'play' && MODE !== 'over') return;
  const ids = Object.keys(S.inventory).filter((k) => S.inventory[k] > 0);
  const lines = ['PACK'];
  if (!ids.length) lines.push('  <span class="dim">(empty)</span>');
  else for (const id of ids) {
    let label = ITEMS[id].name + (S.inventory[id] > 1 ? ` x${S.inventory[id]}` : '');
    if (id === 'canteen') label += ` <span class="water">[${S.canteenWater}/3]</span>`;
    lines.push(`  <span class="loot">${ITEMS[id].glyph}</span> ${label}`);
  }
  $('pack').innerHTML = lines.join('\n');
}

function renderAll() { renderMap(); renderStats(); renderPack(); }

/* ---------------------------------------------------------------------------
   Sound — tiny Web Audio blips, opt-in
   ------------------------------------------------------------------------- */
let AC = null;
function beep(freq, dur, type = 'square') {
  if (!soundOn) return;
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.value = 0.04;
    o.connect(g); g.connect(AC.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
    o.stop(AC.currentTime + dur);
  } catch (_) { /* ignore */ }
}

/* ---------------------------------------------------------------------------
   Turn engine
   ------------------------------------------------------------------------- */
function advanceTurn() {
  if (S.over) return;
  S.turn++;

  // Ankle sprain costs an extra tick of time (metabolism runs twice this move).
  const ticks = S.ankle > 0 ? 2 : 1;
  if (S.ankle > 0) S.ankle--;

  // Fire dies out (or is doused by rain).
  if (S.fireCell) {
    if (S.weather === 'rain' || S.weather === 'storm') { say('The rain hisses your fire down to wet ash.'); S.fireCell = null; }
    else if (S.turn > S.fireUntil) { say('Your fire gutters out to a curl of smoke.'); S.fireCell = null; }
  }

  // Weather.
  if (S.turn >= S.weatherUntil) {
    const prev = S.weather;
    S.weather = weightedWeather();
    S.weatherUntil = S.turn + 4 + rint(5);
    if (S.weather !== prev) announceWeather();
  }

  // Day/night boundary flavor.
  const p = S.turn % CYCLE;
  if (p === DAY_LEN) warn('The light drains from the trees. Night falls — and the cold with it.');
  else if (p === 0 && S.turn > 0) good('Grey dawn seeps through the canopy. You made it through the night.');

  for (let t = 0; t < ticks; t++) metabolize();

  if (!S.over) moveBear();
  if (!S.over) checkDeath();
  autosave();
}

function announceWeather() {
  const msg = {
    clear: 'The sky clears; the air sharpens.',
    fog:   'A cold fog rolls in. You can barely see past your own hands.',
    rain:  'Rain starts to fall, steady and cold.',
    storm: 'The sky blackens. Thunder rolls — a storm is breaking.',
  }[S.weather];
  hint(msg);
}

function metabolize() {
  const st = S.stats;
  st.thirst = Math.max(0, st.thirst - 1);
  if (S.turn % 2 === 0) st.hunger = Math.max(0, st.hunger - 1);

  // Cold at night (and in storms). Shelter, fire, and blankets slow it.
  if (isNight() || S.weather === 'storm') {
    const sheltered = terrainAt(S.player.x, S.player.y) === 'cave';
    const warmedByFire = S.fireCell === key(S.player.x, S.player.y) && S.turn <= S.fireUntil;
    if (warmedByFire) st.warmth = Math.min(st.warmthMax, st.warmth + 2);
    else if (sheltered) { /* no loss in the cave */ }
    else {
      let loss = 1;
      if (S.weather === 'rain' || S.weather === 'storm') loss = 2;
      if (S.inventory.blanket > 0) loss = Math.max(1, loss - 1);
      st.warmth = Math.max(0, st.warmth - loss);
    }
  } else {
    st.warmth = Math.min(st.warmthMax, st.warmth + 2); // warm up in daylight
  }

  // Damage from the worst deprivation.
  const dying = [];
  if (st.thirst === 0) dying.push('thirst');
  if (st.hunger === 0) dying.push('hunger');
  if (st.warmth === 0 && (isNight() || S.weather === 'storm')) dying.push('cold');
  if (dying.length) {
    st.health = Math.max(0, st.health - 1);
    const m = {
      thirst: 'Your throat is raw with thirst.',
      hunger: 'Hunger claws at your gut.',
      cold:   'You can\'t stop shivering. The cold is in your bones.',
    };
    bad(`${dying.map((d) => m[d]).join(' ')} (-1 health)`);
  } else {
    if (st.thirst === 2) warn('Your mouth is dry — find water soon.');
    if (st.hunger === 2) warn('Your stomach growls — you should eat soon.');
    if (st.warmth === 2 && (isNight() || S.weather === 'storm')) warn('You\'re shivering. Get to shelter or make a fire.');
  }
}

/* ---- bear ----------------------------------------------------------------- */
function bearSenseRange() {
  let r = S.cfg.bearRange;
  if (isNight()) r += 1;
  if (S.weather === 'rain' || S.weather === 'storm') r -= 1; // rain washes out your scent
  if (S.weather === 'fog') r -= 1;
  return Math.max(1, r);
}

function moveBear() {
  const B = S.bear, P = S.player;

  // Fleeing: run away for a while.
  if (S.turn <= S.bearFleeUntil) {
    S.bearState = 'flee';
    const step = { dx: Math.sign(B.x - P.x) || (chance(0.5) ? 1 : -1),
                   dy: Math.sign(B.y - P.y) || (chance(0.5) ? 1 : -1) };
    tryMoveBear(step);
    return;
  }

  const dist = cheby(B, P);
  const range = bearSenseRange();
  if (dist <= range) S.bearState = 'hunt';
  else if (S.bearState === 'hunt' && dist > range + 2) S.bearState = 'wander';

  if (S.bearState === 'hunt') {
    if (chance(S.cfg.bearSpeed)) tryMoveBear({ dx: Math.sign(P.x - B.x), dy: Math.sign(P.y - B.y) });
  } else {
    // Amble, drifting home toward the den.
    if (chance(0.5)) tryMoveBear(pick([{dx:1,dy:0},{dx:-1,dy:0},{dx:0,dy:1},{dx:0,dy:-1},{dx:0,dy:0}]));
    else tryMoveBear({ dx: Math.sign(S.den.x - B.x), dy: Math.sign(S.den.y - B.y) });
  }

  const now = cheby(B, P);
  if (B.x === P.x && B.y === P.y) { bearEncounter(); return; }
  if (S.bearState === 'hunt' && now <= 2) { S.bearGlyphUntil = S.turn; renderMap(); }
  if (hasLight() || now === 1) {
    if (now === 1) warn('A branch cracks close by — a low, wet growl. The bear is right on you.');
    else if (now === 2) hint('Fresh bear tracks, and the reek of it hangs in the air.');
  }
}

function tryMoveBear(step) {
  const B = S.bear;
  const nx = clamp(B.x + step.dx, 0, SIZE - 1);
  const ny = clamp(B.y + step.dy, 0, SIZE - 1);
  const nk = key(nx, ny);
  if (fireOn() && nk === S.fireCell) return;      // won't cross fire
  if (terrainAt(nx, ny) === 'ravine') return;     // won't enter ravines
  B.x = nx; B.y = ny;
}

function bearEncounter() {
  const P = S.player;
  S.bearGlyphUntil = S.turn + 1;
  beep(90, 0.25, 'sawtooth');

  if (S.fireCell === key(P.x, P.y) && S.turn <= S.fireUntil) {
    warn('The bear lunges — then recoils from your fire, huffing, and crashes back into the trees.');
    S.bearFleeUntil = S.turn + 4; scatterBear(3); return;
  }
  if (terrainAt(P.x, P.y) === 'cave') {
    warn('The bear snarls at the mouth of the cave but won\'t follow you into the dark. It prowls off.');
    scatterBear(3); return;
  }

  bad('THE BEAR IS ON YOU. It rears up, all claws and breath.');
  if (S.inventory.firetools > 0) {
    say('You spark your flint into a fistful of dry needles and thrust the flame at it. The bear balks and flees.');
    S.bearFleeUntil = S.turn + 4; scatterBear(3);
  } else if (S.inventory.knife > 0 && chance(0.6)) {
    say('You slash out with the hunting knife. The bear yelps and retreats — but not before it rakes you.');
    S.stats.health = Math.max(0, S.stats.health - 1); bad('(-1 health)');
    S.bearFleeUntil = S.turn + 3; scatterBear(4);
  } else {
    S.stats.health = Math.max(0, S.stats.health - 2);
    bad('It mauls you and flings you aside. (-2 health)');
    dropRandomItem();
    const opts = Object.values(DIRS).map((d) => ({ x: P.x + d.dx, y: P.y + d.dy }))
      .filter((c) => inBounds(c.x, c.y) && terrainAt(c.x, c.y) !== 'ravine');
    if (opts.length) { const c = pick(opts); P.x = c.x; P.y = c.y; S.visited.add(key(c.x, c.y)); }
    scatterBear(3);
    if (S.stats.health > 0) say('You scramble away, bleeding, and put ground between you.');
  }
  checkDeath();
}

function scatterBear(minDist) {
  let b, guard = 0;
  do { b = { x: rint(SIZE), y: rint(SIZE) }; guard++; }
  while ((cheby(b, S.player) < minDist || terrainAt(b.x, b.y) === 'ravine') && guard < 200);
  S.bear = b; S.bearState = 'wander';
}

function dropRandomItem() {
  const ids = Object.keys(S.inventory).filter((k) => S.inventory[k] > 0 && k !== 'compass');
  if (!ids.length) return;
  const id = pick(ids);
  S.inventory[id]--; if (S.inventory[id] <= 0) delete S.inventory[id];
  const here = key(S.player.x, S.player.y);
  if (!S.loot.has(here)) S.loot.set(here, id);
  warn(`You drop your ${ITEMS[id].name} in the chaos — it lands nearby.`);
}

function checkDeath() {
  if (S.stats.health <= 0 && !S.over) {
    lose('Your strength gives out. The forest keeps you.');
  }
}

/* ---------------------------------------------------------------------------
   Random trail events (on entering an unvisited cell)
   ------------------------------------------------------------------------- */
function maybeEvent() {
  if (chance(0.72)) return; // most cells are quiet
  const roll = pick(['pack', 'snake', 'ankle', 'note', 'deer', 'nest']);
  switch (roll) {
    case 'pack': {
      const missing = Object.keys(ITEMS).filter((id) => !(S.inventory[id] > 0));
      if (missing.length && !S.loot.has(key(S.player.x, S.player.y))) {
        const id = pick(missing);
        S.loot.set(key(S.player.x, S.player.y), id);
        good(`You trip over a half-rotted backpack. Something\'s still inside — a ${ITEMS[id].name}. Try "take".`);
      } else { hint('An old campsite, long cold. Nothing left worth taking.'); }
      break;
    }
    case 'snake':
      if (S.inventory.knife > 0) say('A snake strikes from the brush — you knock it away with your knife. Close one.');
      else { S.stats.health = Math.max(0, S.stats.health - 1); bad('A snake strikes your ankle before you can react! (-1 health)'); checkDeath(); }
      break;
    case 'ankle':
      if (S.inventory.rope > 0) hint('You slip on deadfall but catch yourself on your rope. No harm done.');
      else { S.ankle = 3; warn('You turn your ankle badly on hidden deadfall. Moving will cost you more for a while.'); }
      break;
    case 'note': {
      const b = bearing(S.player, S.station);
      hint(`A hiker\'s journal, rain-swollen. The last legible line: "station lies to the ${b === 'right here' ? 'nearby' : b}..."`);
      S.stationKnown = true;
      break;
    }
    case 'deer': say('A deer freezes, watches you, and bounds away through the ferns. For a moment it\'s almost peaceful.'); break;
    case 'nest': hint('You disturb a nest of something unseen. Best keep moving.'); break;
  }
}

/* ---------------------------------------------------------------------------
   Win / lose / score
   ------------------------------------------------------------------------- */
function scoreRun(win) {
  let s = S.turn * 2;
  s += Object.values(S.inventory).reduce((a, b) => a + b, 0) * 8;
  s += S.visited.size * 3;
  if (win) s += 500 + S.stats.health * 40 + { easy: 0, normal: 150, hard: 400 }[S.diff];
  return Math.max(0, Math.round(s));
}

function bestScores() {
  try { return JSON.parse(localStorage.getItem(BEST_KEY)) || {}; } catch (_) { return {}; }
}
function saveBest(diff, score) {
  try {
    const b = bestScores();
    if (!b[diff] || score > b[diff]) { b[diff] = score; localStorage.setItem(BEST_KEY, JSON.stringify(b)); return true; }
  } catch (_) {}
  return false;
}

function endGame(win, reason) {
  S.over = true; S.won = win; S.ending = reason;
  S.score = scoreRun(win);
  S.stationKnown = true; if (!win) S.bearGlyphUntil = S.turn;
  clearSave();
  MODE = 'over';
  renderAll();
  rule();
  if (win) {
    good(reason);
    print('★   Y O U   S U R V I V E D   ★', 'banner');
  } else {
    bad(reason);
    print('☠   G A M E   O V E R   ☠', 'banner');
  }
  const isBest = saveBest(S.diff, S.score);
  say(`Difficulty: <b>${S.cfg.label}</b>   Turns: <b>${S.turn}</b>   Items: <b>${Object.values(S.inventory).reduce((a,b)=>a+b,0)}</b>`);
  say(`SCORE: <b class="good">${S.score}</b>${isBest ? '  <span class="warn">◄ NEW BEST!</span>' : `   (best ${bestScores()[S.diff] || 0})`}`);
  beep(win ? 660 : 120, 0.3, win ? 'square' : 'sawtooth');
  if (win) { beep(880, 0.25); }
  hint('Type <b>restart</b> for a new forest, or <b>menu</b> to change difficulty.');
  $('cmd').focus();
}
const win  = (reason) => endGame(true, reason);
const lose = (reason) => endGame(false, reason);

/* ---------------------------------------------------------------------------
   Commands
   ------------------------------------------------------------------------- */
function cmdLook() {
  const P = S.player, t = terrainAt(P.x, P.y);
  if (isNight() && !hasLight()) {
    say('The dark is absolute. You can barely see your own hands — you need a light, or wait for dawn.');
    if (t === 'water') good('You can hear — and feel — water at your feet. You could <b>drink</b>.');
    return;
  }

  const desc = {
    forest:   ['Close-packed pines press in on every side, the light gone green and underwater.',
               'Ferns and deadfall crowd the forest floor. A woodpecker knocks, far off.',
               'The canopy closes overhead; moss softens every trunk and stone.'],
    water:    ['A clear stream runs right past your feet, cold and quick.'],
    hill:     ['You stand on a rocky rise. The trees fall away below — a good place to look out.'],
    clearing: ['A grassy clearing opens to the sky. Anything you burn here would be seen for miles.'],
    berry:    ['Thickets of berry bushes crowd in, heavy with fruit. You could <b>forage</b>.'],
    cave:     ['A low cave mouth breaks the hillside — dry, dark, out of the wind. Good shelter.'],
    ravine:   ['You stand at the lip of a deep ravine.'],
  }[t];
  say(isNight() ? 'By your light, ' + pick(desc).charAt(0).toLowerCase() + pick(desc).slice(1) : pick(desc));

  if (P.x === S.station.x && P.y === S.station.y) { win('You stumble onto the ranger station itself — you\'re safe.'); return; }

  if (t === 'water') good('Fresh water here — you could <b>drink</b> or <b>fill canteen</b>.');
  if (t === 'berry') good('Ripe berries within reach — <b>forage</b> to eat.');
  if (t === 'cave') hint('You\'re sheltered here: no cold at night, and the bear won\'t follow you in.');

  // adjacent water
  for (const [name, d] of Object.entries(DIRS)) {
    if (terrainAt(P.x + d.dx, P.y + d.dy) === 'water' && inBounds(P.x + d.dx, P.y + d.dy)) {
      say(`You hear running water to the <span class="water">${name}</span>.`); break;
    }
  }

  // station proximity
  const sd = cheby(P, S.station);
  if (sd === 1) { good(`Through a gap in the trees — a building. The ranger station, just ${bearing(P, S.station)}!`); S.stationKnown = true; }
  else if (sd <= (S.weather === 'fog' ? 1 : 3)) hint('A faint tang of woodsmoke rides the breeze.');

  // bear proximity
  const bd = cheby(P, S.bear);
  if (bd === 1) warn('Something huge breathes in the brush nearby. Do NOT linger.');
  else if (bd === 2 && S.weather !== 'fog') hint('Claw marks scar a nearby trunk, sap still weeping.');

  // loot here
  if (S.loot.has(key(P.x, P.y))) good(`Half-buried here: <b>${ITEMS[S.loot.get(key(P.x, P.y))].name}</b>. Try <b>take</b>.`);
}

function cmdGo(word) {
  const dir = DIR_ALIAS[word];
  if (!dir) { warn('Go where? Try north, south, east, or west.'); return; }
  const d = DIRS[dir];
  const nx = S.player.x + d.dx, ny = S.player.y + d.dy;
  if (!inBounds(nx, ny)) { say(`You push ${dir}, but the forest only thickens — that\'s the edge of the woods.`); return; }

  if (terrainAt(nx, ny) === 'ravine') {
    if (S.inventory.rope > 0) { say(`You rig your rope and climb down and across the ravine, heading <b>${dir}</b>.`); }
    else { warn(`A deep ravine blocks the way ${dir}. You\'d need a rope to cross it. (try another direction)`); return; }
  } else {
    say(`You push on through the trees, heading <b>${dir}</b>.`);
  }
  beep(220, 0.03);

  S.player.x = nx; S.player.y = ny;
  const fresh = !S.visited.has(key(nx, ny));
  S.visited.add(key(nx, ny));
  advanceTurn();
  if (S.over) return;

  if (S.player.x === S.station.x && S.player.y === S.station.y) { win('You break from the treeline and there it is — the ranger station, lit and smoking. Rescued.'); return; }

  const nt = terrainAt(nx, ny);
  if (nt === 'water') good('A stream cuts across the ground here — fresh water.');
  else if (nt === 'berry') good('You wade into berry thickets — <b>forage</b> for food.');
  else if (nt === 'cave') hint('You duck into a cave mouth — shelter from cold and bear.');
  if (S.loot.has(key(nx, ny))) good(`Something is half-buried here: ${ITEMS[S.loot.get(key(nx, ny))].name}.`);

  if (fresh) maybeEvent();
}

function cmdTake(rest) {
  const k = key(S.player.x, S.player.y);
  if (!S.loot.has(k)) { say('There is nothing here to pick up.'); return; }
  const id = S.loot.get(k);
  if (rest && !ITEMS[id].aliases.some((a) => rest.includes(a) || a.includes(rest))) {
    say(`You don't see any "${rest}" here — but there is a ${ITEMS[id].name}.`); return;
  }
  S.loot.delete(k);
  S.inventory[id] = (S.inventory[id] || 0) + 1;
  good(`You take the ${ITEMS[id].name}.`);
  beep(520, 0.05);
  if (id === 'map') { S.stationKnown = true; for (let x=0;x<SIZE;x++) for (let y=0;y<SIZE;y++) S.mapped.add(key(x,y)); hint('The map fills in the whole valley — the station is marked.'); }
  if (id === 'canteen' && S.canteenWater === 0) hint('Stand on water and <b>fill canteen</b> to carry drinks.');
  if (id === 'firetools') hint('You can <b>make fire</b> now — warmth, a bear-ward, a signal.');
  if (id === 'binocs') hint('Try <b>use binoculars</b> to scan the distance.');
  if (id === 'compass') hint('Your HUD now shows the bearing to the station at all times.');
}

function cmdInventory() {
  const ids = Object.keys(S.inventory).filter((k) => S.inventory[k] > 0);
  if (!ids.length) { say('Your pockets are empty. You have only your wits.'); return; }
  say('You are carrying:');
  for (const id of ids) {
    let line = `  • ${ITEMS[id].name}${S.inventory[id] > 1 ? ` (x${S.inventory[id]})` : ''}`;
    if (id === 'canteen') line += ` — ${S.canteenWater}/3 drinks`;
    say(line);
  }
}

function cmdExamine(rest) {
  if (!rest) { cmdLook(); return; }
  for (const [id, it] of Object.entries(ITEMS)) {
    if (it.aliases.some((a) => rest.includes(a) || a.includes(rest))) {
      const have = S.inventory[id] > 0 ? ' (in your pack)' : '';
      say(`<b>${cap(it.name)}</b>${have}: ${it.desc}`); return;
    }
  }
  cmdLook();
}

function cmdDrink() {
  const onWater = terrainAt(S.player.x, S.player.y) === 'water';
  if (onWater) {
    S.stats.thirst = S.stats.thirstMax;
    good('You kneel and drink deep from the cold stream. Much better.');
    if (S.inventory.canteen > 0 && S.canteenWater < 3) { S.canteenWater = 3; hint('You top off your canteen.'); }
    advanceTurn();
  } else if (S.inventory.canteen > 0 && S.canteenWater > 0) {
    S.canteenWater--; S.stats.thirst = Math.min(S.stats.thirstMax, S.stats.thirst + 4);
    good(`You sip from the canteen. (${S.canteenWater}/3 left)`);
  } else if (S.weather === 'rain' || S.weather === 'storm') {
    S.stats.thirst = Math.min(S.stats.thirstMax, S.stats.thirst + 2);
    say('You tip your head back and catch cold rain on your tongue. It helps a little.');
  } else if (S.inventory.canteen > 0) warn('Your canteen is empty. Find a stream and stand on it to refill.');
  else say('No water here to drink. Listen for running water, or find a canteen.');
}

function cmdFill() {
  if (!(S.inventory.canteen > 0)) { say('You have nothing to fill — you need a canteen.'); return; }
  if (terrainAt(S.player.x, S.player.y) !== 'water') { say('No water here. Stand on a stream first.'); return; }
  S.canteenWater = 3; good('You fill the canteen to the brim. (3/3)');
}

function cmdEat() {
  if (!(S.inventory.rations > 0)) { say('You have no rations. Forage berries or fish for food.'); return; }
  S.inventory.rations--; if (S.inventory.rations <= 0) delete S.inventory.rations;
  S.stats.hunger = Math.min(S.stats.hungerMax, S.stats.hunger + 7);
  good('You tear into the trail rations. Not gourmet, but it quiets your stomach.');
  advanceTurn();
}

function cmdForage() {
  if (terrainAt(S.player.x, S.player.y) !== 'berry') { say('Nothing to forage here. Look for berry thickets (%).'); return; }
  if (chance(0.15)) {
    S.stats.health = Math.max(0, S.stats.health - 1);
    bad('You eat a handful too fast — some were bitter and wrong. Your stomach twists. (-1 health)');
  } else {
    S.stats.hunger = Math.min(S.stats.hungerMax, S.stats.hunger + 4);
    good('You strip a good handful of ripe berries and eat. Tart, but food.');
  }
  advanceTurn();
}

function cmdFish() {
  if (terrainAt(S.player.x, S.player.y) !== 'water') { say('No water here to fish. Stand on a stream.'); return; }
  if (!(S.inventory.fishline > 0)) { say('You have no fishing line.'); return; }
  say('You cast your line into the current and wait, still as the trees.');
  advanceTurn(); if (S.over) return;
  if (chance(0.6)) { S.stats.hunger = Math.min(S.stats.hungerMax, S.stats.hunger + 6); good('A tug — you land a fat trout and eat well.'); }
  else say('Nothing bites. The line comes up empty.');
}

function cmdClimb() {
  const P = S.player;
  const high = terrainAt(P.x, P.y) === 'hill';
  if (S.weather === 'storm') { warn('Climbing in this storm would get you killed. Wait it out.'); return; }
  if (isNight() && !hasLight()) { warn('It\'s too dark to see anything from up there. You need a light.'); return; }

  say(high
    ? 'You pick your way to the top of the rise and shade your eyes.'
    : 'You haul yourself up the tallest pine you can find, needles scratching, until the forest opens below.');

  S.stationKnown = true;
  const sd = cheby(P, S.station);
  const dist = sd <= 2 ? 'close now' : sd <= 5 ? 'some way off' : 'far to go';
  if (S.weather === 'fog') hint('The fog swallows the distance — you can only just make out the station\'s direction.');
  good(`You spot the glint of the ranger station roof: <b>${bearing(P, S.station)}</b>, ${dist}.`);

  // From a hill you also reveal the surrounding terrain on the map.
  if (high) {
    let r = 0;
    for (let dx = -2; dx <= 2; dx++) for (let dy = -2; dy <= 2; dy++) {
      const x = P.x + dx, y = P.y + dy;
      if (inBounds(x, y) && !S.mapped.has(key(x, y))) { S.mapped.add(key(x, y)); r++; }
    }
    if (r) hint('From this height the surrounding land opens up on your map.');
  }

  const bd = cheby(P, S.bear);
  if (bd <= (high ? 6 : 4)) { warn(`You catch the bear moving — ${bearing(P, S.bear)} of you.`); S.bearGlyphUntil = S.turn + 1; }
  else hint('No sign of the bear from here.');

  if (!high && S.inventory.rope <= 0 && chance(0.12)) {
    S.stats.health = Math.max(0, S.stats.health - 1);
    bad('A branch cracks and you half-fall the last few feet. (-1 health)');
  }
  advanceTurn();
  if (!S.over) checkDeath();
}

function cmdBinocs() {
  if (!(S.inventory.binocs > 0)) { say('You have no binoculars. You could climb a tree to see far.'); return; }
  if (isNight() && !hasLight()) { warn('Too dark to make anything out through the lenses.'); return; }
  const P = S.player;
  say('You raise the binoculars and sweep the horizon slowly.');
  S.stationKnown = true;
  say(`The ranger station lies <b>${bearing(P, S.station)}</b>, about ${cheby(P, S.station)} ridges out.`);
  const bd = cheby(P, S.bear);
  if (bd <= 6) { warn(`You pick out the bear: ${bearing(P, S.bear)}, roughly ${bd} away.`); S.bearGlyphUntil = S.turn + 1; }
  else hint('No bear in sight.');
  let found = 0;
  for (const [k] of S.loot) {
    const [lx, ly] = k.split(',').map(Number);
    if (cheby({ x: lx, y: ly }, P) <= 2 && !S.mapped.has(k)) { S.mapped.add(k); found++; }
  }
  if (found) good(`You glass ${found} glint${found > 1 ? 's' : ''} of something useful nearby — now marked on your map.`);
}

function cmdFire() {
  if (!(S.inventory.firetools > 0)) { say('You have nothing to make fire with. Find flint & steel.'); return; }
  const t = terrainAt(S.player.x, S.player.y);
  if (t === 'water') { warn('The ground here is too wet to catch. Move to dry ground.'); return; }
  if (S.weather === 'rain' || S.weather === 'storm') { warn('The rain drowns every spark. You can\'t light a fire in this.'); return; }
  S.fireCell = key(S.player.x, S.player.y); S.fireUntil = S.turn + 4;
  good('You strike sparks into dry tinder and coax up a crackling fire. Warmth, and a ward against the bear.');
  beep(440, 0.08);
  const sd = cheby(S.player, S.station);
  const seen = sd <= 2 || (t === 'clearing' && sd <= 4);
  if (seen) good('A shout answers from the trees — someone at the station has seen your smoke!');
  advanceTurn();
  if (!S.over && seen) win('Boots crash toward you through the brush — a ranger, following your smoke. You\'re saved.');
}

function cmdWhistle() {
  if (!(S.inventory.whistle > 0)) { say('You have no whistle.'); return; }
  say('You put the tin whistle to your lips and blow — a shrill blast splits the quiet.');
  beep(1200, 0.15);
  if (cheby(S.player, S.bear) <= 5) { warn('You hear the bear crash away in alarm.'); S.bearFleeUntil = S.turn + 5; S.bearState = 'flee'; }
  else hint('Only the echo answers.');
  const sd = cheby(S.player, S.station);
  if (sd <= 1) { advanceTurn(); if (!S.over) win('An answering shout — a ranger has heard you, and comes running.'); return; }
  advanceTurn();
}

function cmdFlare() {
  if (!(S.inventory.flare > 0)) { say('You have no flare.'); return; }
  S.inventory.flare--; if (S.inventory.flare <= 0) delete S.inventory.flare;
  say('You crack the flare and it screams up into the sky, burning white.');
  beep(1500, 0.4);
  for (let x = 0; x < SIZE; x++) for (let y = 0; y < SIZE; y++) S.mapped.add(key(x, y));
  S.stationKnown = true; S.bearGlyphUntil = S.turn + 1;
  good('For one blazing moment the whole valley is lit — the map is yours.');
  const sd = cheby(S.player, S.station);
  advanceTurn(); if (S.over) return;
  if (sd <= 4) win('The flare bursts close enough — the station sees it, and rescue is on its way.');
  else hint('But you\'re too far out; no one at the station could have seen it clearly. At least you know the way now.');
}

function cmdHeal() {
  if (!(S.inventory.firstaid > 0)) { say('You have no first-aid kit.'); return; }
  if (S.stats.health >= S.stats.healthMax) { say('You\'re not hurt enough to need it — save the kit.'); return; }
  S.inventory.firstaid--; if (S.inventory.firstaid <= 0) delete S.inventory.firstaid;
  S.stats.health = Math.min(S.stats.healthMax, S.stats.health + 3);
  good('You clean and bind your wounds. That\'s better. (+3 health)');
}

function cmdRest() {
  const t = terrainAt(S.player.x, S.player.y);
  if (t === 'cave') say('You curl up in the dry dark of the cave and let your eyes close a while.');
  else if (fireOn() && S.fireCell === key(S.player.x, S.player.y)) say('You sit close to the fire and let its warmth soak in.');
  else say('You sit against a trunk and catch your breath, ears straining at the dark.');
  advanceTurn();
  if (!S.over) hint('Time passes — and so do the bear, the weather, and the hours.');
}

function cmdLegend() {
  rule(); print('MAP LEGEND', 'banner');
  say(
    '<span class="me">@</span> you   <span class="station">R</span> ranger station   <span class="bear">B</span> bear   <span class="fire">ф</span> fire\n' +
    '<span class="tree">*</span> forest   <span class="water">~</span> water   <span class="hill">^</span> hill   <span class="clearing">"</span> clearing\n' +
    '<span class="berry">%</span> berries   <span class="cave">n</span> cave (shelter)   <span class="ravine">V</span> ravine (needs rope)\n' +
    '<span class="loot">r c b f …</span> dropped gear'
  );
}

function cmdHelp() {
  rule(); print('COMMANDS', 'banner');
  say(
    '<b>look</b> (l) · <b>examine</b> &lt;thing&gt;   study surroundings / an item\n' +
    '<b>north south east west</b> (n s e w)   travel\n' +
    '<b>climb</b> [tree]   scout for the station &amp; bear (a hill sees farther)\n' +
    '<b>take</b> · <b>inventory</b> (i)   pick up / check your pack\n' +
    '<b>drink</b> · <b>fill canteen</b> · <b>eat</b> · <b>forage</b> · <b>fish</b>   water &amp; food\n' +
    '<b>make fire</b>   warmth, bear-ward, rescue signal\n' +
    '<b>use binoculars</b> · <b>blow whistle</b> · <b>use flare</b> · <b>bandage</b>\n' +
    '<b>rest</b> · <b>legend</b> · <b>sound</b> · <b>restart</b> · <b>menu</b>'
  );
  hint('Goal: reach the RANGER STATION (R) — or signal it with a fire/flare. Mind thirst, hunger, cold, and the bear.');
}

/* ---------------------------------------------------------------------------
   Save / resume
   ------------------------------------------------------------------------- */
function serialize() {
  const o = JSON.parse(JSON.stringify({
    diff: S.diff, player: S.player, station: S.station, bear: S.bear, den: S.den,
    bearState: S.bearState, bearFleeUntil: S.bearFleeUntil, bearGlyphUntil: S.bearGlyphUntil,
    inventory: S.inventory, canteenWater: S.canteenWater, stationKnown: S.stationKnown,
    stats: S.stats, turn: S.turn, weather: S.weather, weatherUntil: S.weatherUntil,
    fireCell: S.fireCell, fireUntil: S.fireUntil, ankle: S.ankle,
  }));
  o.terrain = [...S.terrain.entries()];
  o.loot = [...S.loot.entries()];
  o.visited = [...S.visited];
  o.mapped = [...S.mapped];
  return o;
}
function autosave() { if (!S.over) try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize())); } catch (_) {} }
function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (_) {} }
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (_) { return false; } }
function loadSave() {
  try {
    const o = JSON.parse(localStorage.getItem(SAVE_KEY));
    if (!o) return false;
    S = {
      ...o, cfg: DIFFS[o.diff],
      terrain: new Map(o.terrain), loot: new Map(o.loot),
      visited: new Set(o.visited), mapped: new Set(o.mapped),
      over: false, won: false, score: 0, ending: '',
    };
    return true;
  } catch (_) { return false; }
}

/* ---------------------------------------------------------------------------
   Parser
   ------------------------------------------------------------------------- */
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function handleMenu(input) {
  if (/^(1|easy|day)/.test(input)) return beginGame('easy');
  if (/^(2|normal|back)/.test(input)) return beginGame('normal');
  if (/^(3|hard|surv)/.test(input)) return beginGame('hard');
  if (/^(c|continue|resume)/.test(input) && hasSave()) { if (loadSave()) { MODE = 'play'; enterPlay(true); return; } }
  if (/^(sound|mute|audio)/.test(input)) { toggleSound(); return; }
  if (/^(help|\?|controls)/.test(input)) { menuHelp(); return; }
  say('Type <b>1</b>, <b>2</b>, or <b>3</b> to choose a difficulty' + (hasSave() ? ', or <b>continue</b> your saved run.' : '.'));
}

function handle(raw) {
  if (MODE === 'boot') return;                   // ignore input during the boot sequence

  const input = raw.trim().toLowerCase();
  if (!input && MODE !== 'play') return;

  print(`&gt; ${escapeHtml(raw.trim())}`, 'echo');

  if (MODE === 'menu') { handleMenu(input); return; }

  if (MODE === 'over') {
    if (/^(restart|again|new)/.test(input)) return beginGame(S.diff);
    if (/^(menu|title)/.test(input)) return showMenu();
    if (/^(sound|mute)/.test(input)) return toggleSound();
    hint('The game is over. Type <b>restart</b> to play again, or <b>menu</b> to change difficulty.');
    return;
  }

  if (!input) return;
  const words = input.split(/\s+/);
  const verb = words[0];
  const rest = words.slice(1).join(' ');

  if (DIR_ALIAS[verb] && words.length === 1) { cmdGo(verb); renderAll(); return; }
  if (['go','walk','travel','head','move','run'].includes(verb)) { cmdGo(words[1] || ''); renderAll(); return; }

  switch (verb) {
    case 'look': case 'l': case 'survey': cmdLook(); break;
    case 'examine': case 'x': case 'inspect': case 'read': cmdExamine(rest); break;
    case 'climb': cmdClimb(); break;
    case 'take': case 'get': case 'grab': case 'pick': cmdTake(rest.replace(/^up\s+/, '')); break;
    case 'drop': say('Best hold onto everything out here.'); break;
    case 'inventory': case 'i': case 'inv': case 'pack': cmdInventory(); break;
    case 'drink': cmdDrink(); break;
    case 'fill': cmdFill(); break;
    case 'eat': cmdEat(); break;
    case 'forage': case 'pick-berries': case 'berries': cmdForage(); break;
    case 'fish': cmdFish(); break;
    case 'use': case 'wield':
      if (/binoc|scope|glass/.test(rest)) cmdBinocs();
      else if (/fire|flint|match|steel/.test(rest)) cmdFire();
      else if (/canteen|water|drink/.test(rest)) cmdDrink();
      else if (/aid|kit|bandage|medkit/.test(rest)) cmdHeal();
      else if (/whistle|horn/.test(rest)) cmdWhistle();
      else if (/flare|signal/.test(rest)) cmdFlare();
      else if (/map/.test(rest)) cmdLook();
      else say('Use what? Try binoculars, fire, canteen, whistle, flare, or first-aid.');
      break;
    case 'make': case 'light': case 'build': case 'start':
      if (/fire|camp|flame/.test(rest) || rest === '') cmdFire();
      else if (/lantern|lamp/.test(rest)) say('You keep the lantern lit while you carry it.');
      else say('Make what? Try "make fire".');
      break;
    case 'blow': case 'whistle': if (/whistle|horn/.test(rest) || verb === 'whistle') cmdWhistle(); else say('Blow what?'); break;
    case 'signal': case 'smoke': cmdFire(); break;
    case 'flare': cmdFlare(); break;
    case 'binoculars': case 'binocs': case 'scan': cmdBinocs(); break;
    case 'bandage': case 'heal': case 'firstaid': cmdHeal(); break;
    case 'rest': case 'wait': case 'sleep': case 'camp': case 'z': cmdRest(); break;
    case 'legend': case 'key': cmdLegend(); break;
    case 'map': case 'status': case 'stats': say('You take stock. (See the panel above.)'); break;
    case 'sound': case 'mute': case 'audio': toggleSound(); break;
    case 'help': case '?': case 'commands': cmdHelp(); break;
    case 'menu': case 'title': case 'quit': showMenu(); return;
    case 'restart': case 'new': beginGame(S.diff); return;
    default: hint(`You\'re not sure how to "${escapeHtml(verb)}". Type <b>help</b> for what you can do.`);
  }
  renderAll();
}

/* ---------------------------------------------------------------------------
   Sound toggle / UI helpers
   ------------------------------------------------------------------------- */
function toggleSound() {
  soundOn = !soundOn;
  if (soundOn) { beep(660, 0.08); good('Sound ON.'); }
  else say('Sound OFF.');
}

/* ---------------------------------------------------------------------------
   Screens: boot -> menu -> play -> over
   ------------------------------------------------------------------------- */
function bodyMode(m) { document.body.dataset.mode = m; }

function typeLines(lines, delay, done) {
  let i = 0;
  (function next() {
    if (MODE !== 'boot') return;                 // abandoned; another screen took over
    if (i >= lines.length) { if (done) done(); return; }
    const [text, cls] = Array.isArray(lines[i]) ? lines[i] : [lines[i], ''];
    print(text, cls); beep(1400, 0.008);
    i++; setTimeout(next, delay);
  })();
}

function boot() {
  MODE = 'boot'; bodyMode('boot');
  $log().innerHTML = '';
  const lines = [
    ['LAB980 BIOS v9.80  —  (C) 1988 LAB980 SYSTEMS', 'dim'],
    ['Detecting memory ......... 640K OK', 'dim'],
    ['Detecting display ........ EGA 640x350 16-COLOR', 'dim'],
    ['Detecting audio .......... PC SPEAKER', 'dim'],
    ['Loading FOREST.EXE .......', 'dim'],
    ['', ''],
  ];
  typeLines(lines, 260, showMenu);
}

function menuHelp() {
  say('You wander a 10×10 forest looking for the ranger station (R). Move with n/s/e/w, <b>look</b> around, <b>climb</b> for a bearing, and manage thirst, hunger, cold — and a bear. Full commands appear once you\'re playing (type <b>help</b>).');
}

function showMenu() {
  MODE = 'menu'; bodyMode('menu');
  $log().innerHTML = '';
  print('L O S T   I N   T H E   F O R E S T', 'banner');
  say('<span class="dim">a survival text adventure</span>');
  rule();
  say('You\'re lost in the wilderness with no memory of how you got here.');
  say('Find the <b>ranger station</b> before thirst, hunger, the cold — or the bear — find you.');
  print('&nbsp;', 'dim');
  say('Choose your ordeal:');
  say('  <b class="good">1</b>  DAY HIKE      <span class="dim">— forgiving. You start with a canteen &amp; map.</span>');
  say('  <b class="good">2</b>  BACKCOUNTRY   <span class="dim">— the real thing.</span>');
  say('  <b class="good">3</b>  SURVIVALIST   <span class="dim">— scarce water, a keen bear, long nights.</span>');
  const best = bestScores();
  if (best.easy || best.normal || best.hard) {
    print('&nbsp;', 'dim');
    say(`<span class="dim">Best scores — Day Hike: ${best.easy||0}   Backcountry: ${best.normal||0}   Survivalist: ${best.hard||0}</span>`);
  }
  if (hasSave()) { print('&nbsp;', 'dim'); say('  <b class="good">continue</b>  — resume your saved run.'); }
  print('&nbsp;', 'dim');
  hint('Type a number and press Enter. (Also: <b>sound</b> to toggle audio.)');
  $('cmd').focus();
}

function enterPlay(resumed) {
  MODE = 'play'; bodyMode('play');
  $log().innerHTML = '';
  renderAll();
  if (resumed) {
    print('...resuming your run.', 'dim');
    say(`You\'re still out here — turn ${S.turn}, ${phaseName()}. The trees go on in every direction.`);
    rule();
    cmdLook();
  } else {
    print(`L O S T   I N   T H E   F O R E S T   —   ${S.cfg.label}`, 'banner');
    say('You come to face-down in the pine duff with no memory of how you got here. Your head throbs. The trees go on in every direction — a wall of green.');
    say('Somewhere out here is a <b>ranger station</b>. Find it before the wilderness wears you down.');
    hint('The panel above is the forest. <span class="me">@</span> is you. Type <b>look</b> to begin, <b>legend</b> for the map key, or <b>help</b> for commands.');
    rule();
    cmdLook();
  }
  renderAll();
  $('cmd').focus();
}

function beginGame(diffName) {
  S = generate(diffName);
  autosave();
  enterPlay(false);
}

/* ---------------------------------------------------------------------------
   Boot wiring
   ------------------------------------------------------------------------- */
window.addEventListener('DOMContentLoaded', () => {
  const form = $('prompt');
  const input = $('cmd');
  const history = [];
  let hpos = -1;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = input.value;
    if (raw.trim()) { history.push(raw); hpos = history.length; }
    input.value = '';
    try { handle(raw); }
    catch (err) { bad('Something went wrong in the woods: ' + err.message); console.error(err); }
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') { if (hpos > 0) { hpos--; input.value = history[hpos]; e.preventDefault(); } }
    else if (e.key === 'ArrowDown') {
      if (hpos < history.length - 1) { hpos++; input.value = history[hpos]; }
      else { hpos = history.length; input.value = ''; }
    }
  });

  // On-screen keypad (mobile-friendly; works everywhere).
  document.querySelectorAll('#keypad button').forEach((btn) => {
    btn.addEventListener('click', () => {
      try { handle(btn.dataset.cmd); } catch (err) { console.error(err); }
      input.focus();
    });
  });

  // Keep focus on the prompt when tapping the screen (but allow text selection).
  $('screen').addEventListener('click', () => { if (!window.getSelection().toString()) input.focus(); });

  boot();
});
