/* =============================================================================
   LOST IN THE FOREST
   A DOS-era text adventure, reborn in the browser.

   You wake disoriented somewhere in a 10x10 stretch of forest. Somewhere out
   there is a ranger station. Somewhere out there is also a bear. Find the
   station before thirst, hunger, or the bear finds you.

   No framework, no build step — just a state machine and a command parser.
   ========================================================================== */

'use strict';

const SIZE = 10;

/* ---- item catalogue -------------------------------------------------------
   Each item can be found on the grid and carried in your pack. */
const ITEMS = {
  rations:  { name: 'trail rations',   glyph: 'r', aliases: ['ration', 'rations', 'food', 'jerky'] },
  canteen:  { name: 'canteen',         glyph: 'c', aliases: ['canteen', 'flask', 'bottle'] },
  binocs:   { name: 'binoculars',      glyph: 'b', aliases: ['binoculars', 'binocs', 'glasses', 'scope'] },
  firetools:{ name: 'flint & steel',   glyph: 'f', aliases: ['flint', 'steel', 'firetools', 'fire tools', 'matches', 'lighter'] },
  map:      { name: 'tattered map',    glyph: 'm', aliases: ['map', 'chart'] },
  firstaid: { name: 'first-aid kit',   glyph: '+', aliases: ['first-aid', 'first aid', 'firstaid', 'kit', 'medkit', 'bandage'] },
  knife:    { name: 'hunting knife',   glyph: 'k', aliases: ['knife', 'blade'] },
  rope:     { name: 'coil of rope',    glyph: '=', aliases: ['rope', 'coil'] },
};

const DIRS = {
  north: { dx: 0, dy: -1 }, south: { dx: 0, dy: 1 },
  east:  { dx: 1, dy: 0 },  west:  { dx: -1, dy: 0 },
};
const DIR_ALIAS = { n: 'north', s: 'south', e: 'east', w: 'west',
  north: 'north', south: 'south', east: 'east', west: 'west',
  up: 'north', down: 'south', left: 'west', right: 'east' };

/* ---------------------------------------------------------------------------
   Random helpers
   ------------------------------------------------------------------------- */
const rint = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rint(arr.length)];
const key = (x, y) => `${x},${y}`;
const chance = (p) => Math.random() < p;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const inBounds = (x, y) => x >= 0 && x < SIZE && y >= 0 && y < SIZE;

/* Compass bearing from a to b, e.g. "northeast". */
function bearing(from, to) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const ns = dy < 0 ? 'north' : dy > 0 ? 'south' : '';
  const ew = dx > 0 ? 'east'  : dx < 0 ? 'west'  : '';
  return (ns + ew) || 'right here';
}
function chebyshev(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }

/* ---------------------------------------------------------------------------
   State
   ------------------------------------------------------------------------- */
let S = null;

function freshState() {
  const taken = new Set();
  const freeCell = () => {
    let x, y;
    do { x = rint(SIZE); y = rint(SIZE); } while (taken.has(key(x, y)));
    taken.add(key(x, y));
    return { x, y };
  };

  const player = freeCell();
  const station = freeCell();

  // Bear starts at least 4 cells away so you get a running start.
  let bear;
  do { bear = { x: rint(SIZE), y: rint(SIZE) }; }
  while (chebyshev(bear, player) < 4 || (bear.x === station.x && bear.y === station.y));

  // A stream (a wandering line of water) plus a small pond, for drinking.
  const water = new Set();
  const horizontal = chance(0.5);
  const fixed = rint(SIZE);
  let drift = rint(SIZE);
  for (let i = 0; i < SIZE; i++) {
    const wx = horizontal ? i : clamp(drift, 0, SIZE - 1);
    const wy = horizontal ? clamp(drift, 0, SIZE - 1) : i;
    water.add(key(wx, wy));
    if (chance(0.45)) drift += chance(0.5) ? 1 : -1;
  }
  const pond = freeCell();
  water.add(key(pond.x, pond.y));

  // Scatter the loot — every item once, on its own cell.
  const loot = new Map();
  const place = (id) => { const c = freeCell(); loot.set(key(c.x, c.y), id); };
  ['rations', 'rations', 'canteen', 'binocs', 'firetools',
   'map', 'firstaid', 'knife', 'rope'].forEach(place);

  return {
    player, station, bear, water, loot,
    inventory: {},          // id -> count
    canteenWater: 0,        // drinks carried once you own the canteen
    visited: new Set([key(player.x, player.y)]),
    stationKnown: false,    // has its glyph been revealed on the map?
    bearGlyphUntil: -1,     // turn until which the bear shows on the map
    stats: { hunger: 14, thirst: 9, health: 5 },
    turn: 0,
    fireCell: null,         // key of a currently-burning cell
    fireUntil: -1,          // turn the fire dies
    over: false, won: false,
  };
}

/* ---------------------------------------------------------------------------
   Rendering
   ------------------------------------------------------------------------- */
const $log = () => document.getElementById('log');

function print(html, cls) {
  const p = document.createElement('p');
  if (cls) p.className = cls;
  p.innerHTML = html;
  $log().appendChild(p);
  $log().scrollTop = $log().scrollHeight;
}
const rule = () => { const hr = document.createElement('hr'); $log().appendChild(hr); };
const say  = (t) => print(t);
const warn = (t) => print(t, 'warn');
const bad  = (t) => print(t, 'bad');
const good = (t) => print(t, 'good');
const hint = (t) => print(t, 'hint');

function renderMap() {
  const rows = [];
  const fireOn = S.fireCell && S.turn <= S.fireUntil;
  for (let y = 0; y < SIZE; y++) {
    let row = '';
    for (let x = 0; x < SIZE; x++) {
      const here = key(x, y);
      let glyph = '*', cls = 'tree';
      if (S.visited.has(here)) { glyph = '·'; cls = 'seen'; }
      if (S.water.has(here) && (S.visited.has(here))) { glyph = '~'; cls = 'water'; }
      if (S.loot.has(here) && S.visited.has(here)) { glyph = ITEMS[S.loot.get(here)].glyph; cls = 'loot'; }
      if (S.stationKnown && x === S.station.x && y === S.station.y) { glyph = 'R'; cls = 'station'; }
      if (fireOn && here === S.fireCell) { glyph = 'ф'; cls = 'bear'; }
      if (S.turn <= S.bearGlyphUntil && x === S.bear.x && y === S.bear.y) { glyph = 'B'; cls = 'bear'; }
      if (x === S.player.x && y === S.player.y) { glyph = '@'; cls = 'me'; }
      row += `<span class="${cls}">${glyph}</span> `;
    }
    rows.push(row.trimEnd());
  }
  document.getElementById('map').innerHTML = rows.join('\n');
}

function bar(val, max, ch) {
  const n = clamp(Math.round((val / max) * 10), 0, 10);
  return ch.repeat(n) + '·'.repeat(10 - n);
}

function renderStats() {
  const { hunger, thirst, health } = S.stats;
  const daytime = (Math.floor(S.turn / 8) % 2) === 0;
  const tod = daytime ? 'daylight' : 'nightfall';
  const hp = health <= 1 ? 'bad' : health <= 2 ? 'warn' : 'good';
  const th = thirst <= 2 ? 'bad' : thirst <= 4 ? 'warn' : 'dim';
  const hu = hunger <= 2 ? 'bad' : hunger <= 4 ? 'warn' : 'dim';
  document.getElementById('stats').innerHTML =
    `HEALTH  <span class="${hp}">${bar(health, 5, '#')}</span>\n` +
    `THIRST  <span class="${th}">${bar(thirst, 9, '=')}</span>\n` +
    `HUNGER  <span class="${hu}">${bar(hunger, 14, '=')}</span>\n` +
    `\nTURN ${String(S.turn).padStart(3, '0')}   <span class="dim">${tod}</span>`;
}

function renderPack() {
  const lines = ['PACK'];
  const ids = Object.keys(S.inventory).filter((k) => S.inventory[k] > 0);
  if (!ids.length) {
    lines.push('  <span class="dim">(empty)</span>');
  } else {
    for (const id of ids) {
      const c = S.inventory[id];
      let label = ITEMS[id].name + (c > 1 ? ` x${c}` : '');
      if (id === 'canteen') label += ` <span class="water">[${S.canteenWater}/3]</span>`;
      lines.push(`  <span class="loot">${ITEMS[id].glyph}</span> ${label}`);
    }
  }
  document.getElementById('pack').innerHTML = lines.join('\n');
}

function renderAll() { renderMap(); renderStats(); renderPack(); }

/* ---------------------------------------------------------------------------
   World simulation — the passage of time
   ------------------------------------------------------------------------- */
function advanceTurn() {
  if (S.over) return;
  S.turn++;

  // Fire burns out.
  if (S.fireCell && S.turn > S.fireUntil) {
    say('Your fire gutters out to a curl of smoke.');
    S.fireCell = null;
  }

  // Metabolism. Thirst is the pressure; hunger is slower.
  S.stats.thirst = Math.max(0, S.stats.thirst - 1);
  if (S.turn % 2 === 0) S.stats.hunger = Math.max(0, S.stats.hunger - 1);

  if (S.stats.thirst === 0 && S.stats.hunger === 0) {
    S.stats.health--; bad('Parched and starving, you can barely stand. (-1 health)');
  } else if (S.stats.thirst === 0) {
    S.stats.health--; bad('Your throat is raw with thirst. You need water NOW. (-1 health)');
  } else if (S.stats.hunger === 0) {
    S.stats.health--; bad('Hunger gnaws at you and your hands shake. (-1 health)');
  } else {
    if (S.stats.thirst === 2) warn('Your mouth is dry. You should find water soon.');
    if (S.stats.hunger === 2) warn('Your stomach growls. You should eat soon.');
  }

  moveBear();
  if (!S.over) checkDeath();
}

function moveBear() {
  const B = S.bear, P = S.player;
  const dist = chebyshev(B, P);

  // Won't wander onto a burning cell.
  const fireOn = S.fireCell && S.turn <= S.fireUntil;

  // Close in when it smells you; otherwise it ambles.
  let step;
  if (dist <= 3 && chance(0.7)) {
    step = { dx: Math.sign(P.x - B.x), dy: Math.sign(P.y - B.y) };
  } else {
    step = pick([{ dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 },
                 { dx: 0, dy: -1 }, { dx: 0, dy: 0 }]);
  }
  const nx = clamp(B.x + step.dx, 0, SIZE - 1);
  const ny = clamp(B.y + step.dy, 0, SIZE - 1);
  if (!(fireOn && key(nx, ny) === S.fireCell)) { B.x = nx; B.y = ny; }

  const now = chebyshev(B, P);
  if (B.x === P.x && B.y === P.y) { bearEncounter(); return; }
  if (now === 1) warn('A branch snaps close by. Something big is moving — a low, wet growl.');
  else if (now === 2) hint('You find fresh bear tracks pressed into the dirt.');
}

function bearEncounter() {
  const P = S.player;
  S.bearGlyphUntil = S.turn + 1;

  // Fire on your cell keeps it at bay entirely.
  if (S.fireCell === key(P.x, P.y) && S.turn <= S.fireUntil) {
    warn('The bear lunges — then recoils from your fire, huffing, and melts back into the trees.');
    scatterBear(3);
    return;
  }

  bad('THE BEAR IS ON YOU. It rears up, all claws and breath.');

  if (S.inventory.firetools > 0) {
    say('You snatch up your flint and spark a fistful of dry needles into a torch. The bear balks and crashes off into the brush.');
    scatterBear(3);
  } else if (S.inventory.knife > 0 && chance(0.6)) {
    say('You slash out with the hunting knife. The bear yelps, thinks better of it, and retreats.');
    S.stats.health = Math.max(0, S.stats.health - 1);
    bad('Not before it rakes you once. (-1 health)');
    scatterBear(4);
  } else {
    S.stats.health = Math.max(0, S.stats.health - 2);
    bad('It mauls you and flings you aside. (-2 health)');
    dropRandomItem();
    // Knocked to a random adjacent cell.
    const opts = Object.values(DIRS)
      .map((d) => ({ x: P.x + d.dx, y: P.y + d.dy }))
      .filter((c) => inBounds(c.x, c.y));
    if (opts.length) { const c = pick(opts); P.x = c.x; P.y = c.y; S.visited.add(key(c.x, c.y)); }
    scatterBear(3);
    if (S.stats.health > 0) say('You scramble away, bleeding, and put some distance between you.');
  }
  checkDeath();
}

function scatterBear(minDist) {
  let b;
  do { b = { x: rint(SIZE), y: rint(SIZE) }; } while (chebyshev(b, S.player) < minDist);
  S.bear = b;
}

function dropRandomItem() {
  const ids = Object.keys(S.inventory).filter((k) => S.inventory[k] > 0);
  if (!ids.length) return;
  const id = pick(ids);
  S.inventory[id]--;
  if (S.inventory[id] <= 0) delete S.inventory[id];
  const here = key(S.player.x, S.player.y);
  if (!S.loot.has(here)) S.loot.set(here, id); // it lands nearby, recoverable
  warn(`You drop your ${ITEMS[id].name} in the chaos.`);
}

function checkDeath() {
  if (S.stats.health <= 0 && !S.over) lose('Your strength gives out. The forest keeps you.');
}

/* ---------------------------------------------------------------------------
   Win / lose
   ------------------------------------------------------------------------- */
function win() {
  S.over = true; S.won = true;
  S.stationKnown = true; renderAll();
  rule();
  good('You stumble out of the treeline and there it is: the RANGER STATION, windows lit, a curl of smoke from the chimney.');
  say('A ranger sees you, drops her coffee, and comes running. You made it out of the woods.');
  print('★  YOU SURVIVED  ★', 'banner');
  hint(`Rescued on turn ${S.turn}. Type <b>restart</b> to get lost all over again.`);
}

function lose(reason) {
  S.over = true; S.won = false;
  S.bearGlyphUntil = S.turn; renderAll();
  rule();
  bad(reason);
  print('☠  GAME OVER  ☠', 'banner');
  hint('Type <b>restart</b> to try again.');
}

/* ---------------------------------------------------------------------------
   Commands
   ------------------------------------------------------------------------- */
function cellItemsList(k) {
  return S.loot.has(k) ? [S.loot.get(k)] : [];
}

function cmdLook() {
  const P = S.player, k = key(P.x, P.y);
  const day = (Math.floor(S.turn / 8) % 2) === 0;

  const scenes = [
    'Close-packed pines press in on every side, the light green and underwater.',
    'Ferns and deadfall crowd the forest floor. Birdsong, then nothing.',
    'The canopy closes overhead. Moss softens every trunk and stone.',
    'A still, resinous hush. Somewhere a woodpecker knocks, far off.',
  ];
  say(day ? pick(scenes) : 'Darkness thickens between the trunks. You can barely see your own hands.');

  // On the station?
  if (P.x === S.station.x && P.y === S.station.y) { win(); return; }

  // Water adjacent?
  for (const [name, d] of Object.entries(DIRS)) {
    if (S.water.has(key(P.x + d.dx, P.y + d.dy))) {
      say(`You hear running water to the <span class="water">${name}</span>.`);
      break;
    }
  }
  if (S.water.has(k)) good('A clear stream runs right past your feet here. You could <b>drink</b>.');

  // Station near?
  const sd = chebyshev(P, S.station);
  if (sd === 1) { good(`Through a gap in the trees you glimpse a building — the ranger station, just ${bearing(P, S.station)}!`); S.stationKnown = true; }
  else if (sd <= 3) hint('You catch a faint tang of woodsmoke on the breeze.');

  // Bear near?
  const bd = chebyshev(P, S.bear);
  if (bd === 1) warn('Something large breathes in the brush nearby. Do NOT linger.');
  else if (bd === 2) hint('Claw marks scar a nearby trunk, sap still weeping. Fresh.');

  // Loot here?
  const here = cellItemsList(k);
  if (here.length) good(`Half-buried here: ${here.map((id) => `<b>${ITEMS[id].name}</b>`).join(', ')}. Try <b>take</b>.`);
  else say('Nothing useful catches your eye on the ground.');
}

function cmdGo(dirWord) {
  const dir = DIR_ALIAS[dirWord];
  if (!dir) { warn('Go where? Try north, south, east, or west.'); return; }
  const d = DIRS[dir];
  const nx = S.player.x + d.dx, ny = S.player.y + d.dy;
  if (!inBounds(nx, ny)) {
    say(`You push ${dir} but the forest just gets denser — you can't go further that way. (edge of the woods)`);
    return;
  }
  S.player.x = nx; S.player.y = ny;
  S.visited.add(key(nx, ny));
  say(`You push on through the trees, heading <b>${dir}</b>.`);
  advanceTurn();
  if (S.over) return;

  if (S.player.x === S.station.x && S.player.y === S.station.y) { win(); return; }

  // Auto-glimpse of loot underfoot.
  const here = cellItemsList(key(nx, ny));
  if (here.length) good(`Something is half-buried here: ${here.map((id) => ITEMS[id].name).join(', ')}.`);
  if (S.water.has(key(nx, ny))) good('A stream cuts across the ground here — fresh water.');
}

function cmdTake(rest) {
  const k = key(S.player.x, S.player.y);
  if (!S.loot.has(k)) { say('There is nothing here to pick up.'); return; }
  const id = S.loot.get(k);
  if (rest && !ITEMS[id].aliases.some((a) => rest.includes(a) || a.includes(rest))) {
    say(`You don't see any "${rest}" here — but there is a ${ITEMS[id].name}.`);
    return;
  }
  S.loot.delete(k);
  S.inventory[id] = (S.inventory[id] || 0) + 1;
  good(`You pocket the ${ITEMS[id].name}.`);
  if (id === 'map') hint('The map fills in the lay of the land — the station is marked on it.');
  if (id === 'map') S.stationKnown = true;
  if (id === 'binocs') hint('Try <b>use binoculars</b> to scan the distance.');
  if (id === 'firetools') hint('Now you can <b>make fire</b> — and fend off the bear.');
  if (id === 'canteen') hint('Stand on water and <b>fill canteen</b> to carry drinks with you.');
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

function cmdDrink() {
  const onWater = S.water.has(key(S.player.x, S.player.y));
  if (onWater) {
    S.stats.thirst = 9;
    good('You kneel and drink deep from the cold stream. Much better.');
    if (S.inventory.canteen > 0 && S.canteenWater < 3) {
      S.canteenWater = 3; hint('You top off your canteen while you\'re here.');
    }
    advanceTurn();
  } else if (S.inventory.canteen > 0 && S.canteenWater > 0) {
    S.canteenWater--; S.stats.thirst = Math.min(9, S.stats.thirst + 4);
    good(`You sip from the canteen. (${S.canteenWater}/3 left)`);
  } else if (S.inventory.canteen > 0) {
    warn('Your canteen is empty. Find a stream and stand on it to refill.');
  } else {
    say('There is no water here to drink. Listen for running water, or find a canteen.');
  }
}

function cmdFill() {
  if (!(S.inventory.canteen > 0)) { say('You have nothing to fill. You need a canteen.'); return; }
  if (!S.water.has(key(S.player.x, S.player.y))) { say('No water here to fill from. Stand on a stream first.'); return; }
  S.canteenWater = 3; good('You fill the canteen to the brim. (3/3)');
}

function cmdEat() {
  if (!(S.inventory.rations > 0)) { say('You have no food. Better find some rations.'); return; }
  S.inventory.rations--;
  if (S.inventory.rations <= 0) delete S.inventory.rations;
  S.stats.hunger = Math.min(14, S.stats.hunger + 7);
  good('You tear into the trail rations. Not gourmet, but it quiets your stomach.');
  advanceTurn();
}

function cmdClimb() {
  const P = S.player;
  say('You pick the tallest pine you can find and haul yourself up, needles scratching, until the forest opens out below.');

  const slipRisk = S.inventory.rope > 0 ? 0 : 0.12;
  const bearing2 = bearing(P, S.station);
  const sd = chebyshev(P, S.station);
  S.stationKnown = true;
  const dist = sd <= 2 ? 'close now' : sd <= 5 ? 'some way off' : 'far to go';
  good(`From up here you spot the glint of the ranger station roof: <b>${bearing2}</b>, ${dist}.`);

  const bd = chebyshev(P, S.bear);
  if (bd <= 4) { warn(`You also catch the bear moving — ${bearing(P, S.bear)} of you.`); S.bearGlyphUntil = S.turn + 1; }
  else hint('No sign of the bear from here.');

  if (chance(slipRisk)) {
    S.stats.health = Math.max(0, S.stats.health - 1);
    bad('A branch cracks and you half-fall the last few feet. (-1 health)');
  }
  advanceTurn();
  if (!S.over) checkDeath();
}

function cmdBinocs() {
  if (!(S.inventory.binocs > 0)) { say('You have no binoculars. You\'d have to climb a tree to see far.'); return; }
  const P = S.player;
  say('You raise the binoculars and sweep the horizon slowly.');
  S.stationKnown = true;
  say(`The ranger station lies <b>${bearing(P, S.station)}</b> of here, roughly ${chebyshev(P, S.station)} ridges out.`);
  const bd = chebyshev(P, S.bear);
  if (bd <= 6) { warn(`You pick out the bear: ${bearing(P, S.bear)}, about ${bd} away. Keep your distance.`); S.bearGlyphUntil = S.turn + 1; }
  else hint('No bear in sight.');
  // Reveal nearby loot on the map.
  let found = 0;
  for (const [k] of S.loot) {
    const [lx, ly] = k.split(',').map(Number);
    if (chebyshev({ x: lx, y: ly }, P) <= 2) { S.visited.add(k); found++; }
  }
  if (found) good(`You glass ${found} glint${found > 1 ? 's' : ''} of something useful nearby — now marked.`);
}

function cmdFire() {
  if (!(S.inventory.firetools > 0)) { say('You have nothing to make fire with. Look for flint & steel, or matches.'); return; }
  const k = key(S.player.x, S.player.y);
  if (S.water.has(k)) { warn('The ground here is too wet to catch. Move to dry ground first.'); return; }
  S.fireCell = k; S.fireUntil = S.turn + 4;
  good('You strike sparks into a nest of dry needles and coax up a crackling fire. It will keep the bear off — and may be seen.');
  const sd = chebyshev(S.player, S.station);
  if (sd <= 2) good('A shout answers from the trees — someone at the station has seen your smoke and is coming!');
  advanceTurn();
  // A signal fire close to the station brings rescue.
  if (!S.over && sd <= 2) win();
}

function cmdHeal() {
  if (!(S.inventory.firstaid > 0)) { say('You have no first-aid kit.'); return; }
  if (S.stats.health >= 5) { say('You\'re not hurt enough to need it — save the kit.'); return; }
  S.inventory.firstaid--;
  if (S.inventory.firstaid <= 0) delete S.inventory.firstaid;
  S.stats.health = Math.min(5, S.stats.health + 3);
  good('You clean and bind your wounds. That\'s better. (+3 health)');
}

function cmdRest() {
  say('You sit against a trunk and catch your breath, ears straining at the dark.');
  advanceTurn();
  if (!S.over) hint('Resting passes the time — but the forest, and the bear, keep moving.');
}

function cmdHelp() {
  rule();
  print('COMMANDS', 'banner');
  say(
    '<b>look</b> (l)         — study your surroundings\n' +
    '<b>north/south/east/west</b> (n s e w) — travel\n' +
    '<b>climb tree</b>       — scout for the station and the bear\n' +
    '<b>take</b> [item]      — pick up what\'s at your feet\n' +
    '<b>inventory</b> (i)    — check your pack\n' +
    '<b>drink</b> / <b>fill canteen</b> — water (find a stream)\n' +
    '<b>eat</b>              — eat trail rations\n' +
    '<b>use binoculars</b>   — scan the distance (needs binoculars)\n' +
    '<b>make fire</b>        — ward off the bear / signal (needs flint)\n' +
    '<b>bandage</b>          — use the first-aid kit\n' +
    '<b>rest</b>             — wait a turn\n' +
    '<b>map</b> / <b>status</b>     — redraw the HUD\n' +
    '<b>restart</b>          — new forest, new start'
  );
  hint('Goal: reach the RANGER STATION (R). Watch thirst, hunger, health — and the bear.');
}

/* ---------------------------------------------------------------------------
   Parser
   ------------------------------------------------------------------------- */
function handle(raw) {
  const input = raw.trim().toLowerCase();
  if (!input) return;

  print(`&gt; ${escapeHtml(raw.trim())}`, 'echo');

  if (S.over && !/^(restart|new|again|help|\?)/.test(input)) {
    hint('The game is over. Type <b>restart</b> to play again.');
    return;
  }

  const words = input.split(/\s+/);
  let verb = words[0];
  const rest = words.slice(1).join(' ');

  // Bare direction: "n", "north"
  if (DIR_ALIAS[verb] && words.length === 1) { cmdGo(verb); renderAll(); return; }

  // "go north", "walk north", "travel n", "head e"
  if (['go', 'walk', 'travel', 'head', 'move', 'run'].includes(verb)) { cmdGo(words[1] || ''); renderAll(); return; }

  switch (verb) {
    case 'look': case 'l': case 'examine': case 'x': case 'survey':
      cmdLook(); break;
    case 'climb':
      cmdClimb(); break;
    case 'take': case 'get': case 'grab': case 'pick':
      cmdTake(rest.replace(/^up\s+/, '')); break;
    case 'inventory': case 'i': case 'inv': case 'pack':
      cmdInventory(); break;
    case 'drink':
      cmdDrink(); break;
    case 'fill':
      cmdFill(); break;
    case 'eat':
      cmdEat(); break;
    case 'use': {
      if (/binoc|scope|glass/.test(rest)) cmdBinocs();
      else if (/fire|flint|match|steel/.test(rest)) cmdFire();
      else if (/canteen|water/.test(rest)) cmdDrink();
      else if (/aid|kit|bandage|medkit/.test(rest)) cmdHeal();
      else if (/map/.test(rest)) { S.stationKnown = S.inventory.map > 0 || S.stationKnown; cmdLook(); }
      else say(`Use what? You could use binoculars, fire, a canteen, or a first-aid kit.`);
      break;
    }
    case 'make': case 'light': case 'build': case 'start':
      if (/fire|camp|flame/.test(rest) || rest === '') cmdFire(); else say('Make what?');
      break;
    case 'signal': case 'smoke':
      cmdFire(); break;
    case 'binoculars': case 'binocs': case 'scan':
      cmdBinocs(); break;
    case 'bandage': case 'heal': case 'firstaid':
      cmdHeal(); break;
    case 'rest': case 'wait': case 'sleep': case 'z':
      cmdRest(); break;
    case 'map': case 'status': case 'stats':
      say('You take stock. (HUD refreshed above.)'); break;
    case 'help': case '?': case 'commands':
      cmdHelp(); break;
    case 'restart': case 'new': case 'again':
      startGame(); return;
    default:
      hint(`You're not sure how to "${escapeHtml(verb)}". Type <b>help</b> for what you can do.`);
  }
  renderAll();
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------------------------------------------------------------------
   Boot
   ------------------------------------------------------------------------- */
function startGame() {
  S = freshState();
  $log().innerHTML = '';
  renderAll();

  print('L O S T   I N   T H E   F O R E S T', 'banner');
  say('You come to face-down in the pine duff with no memory of how you got here. Your head throbs. The trees go on in every direction — a wall of green.');
  say('Somewhere out here there is a <b>ranger station</b>. Find it before the wilderness wears you down.');
  hint('The map above is the forest. <span class="me">@</span> is you. Visited ground fades to <span class="seen">·</span>. Type <b>look</b> to begin, or <b>help</b> for commands.');
  rule();
  cmdLook();
  renderAll();
  document.getElementById('cmd').focus();
}

window.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('prompt');
  const input = document.getElementById('cmd');

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

  // Up/down to recall previous commands, like a real shell.
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      if (hpos > 0) { hpos--; input.value = history[hpos]; e.preventDefault(); }
    } else if (e.key === 'ArrowDown') {
      if (hpos < history.length - 1) { hpos++; input.value = history[hpos]; }
      else { hpos = history.length; input.value = ''; }
    }
  });

  // Keep focus on the prompt; tapping anywhere refocuses (mobile-friendly).
  document.getElementById('screen').addEventListener('click', (e) => {
    if (window.getSelection().toString()) return; // don't steal text selection
    input.focus();
  });

  startGame();
});
