# Lost in the Forest 🌲

A DOS/EGA-era survival text adventure, reborn as a green-phosphor CRT terminal
framed inside a period-correct 4:3 monitor.

You wake face-down in the pine duff with no memory of how you got there. A
**10×10 grid** is the wilderness around you; `@` is you. Somewhere in the trees
is a **ranger station** — reach it (or signal it) and you're rescued. Somewhere
out there is also a **bear**. Thirst, hunger, and the cold of night are all
ticking down.

Play it by typing commands, just like 1988.

## Playing

Open `index.html` in any browser — no build, no server, no dependencies. Pick a
difficulty on the title screen and go. (On touch, use the button row under the
screen.)

**Sound is on by default** — an emulated IBM PC speaker (1-bit square-wave
beeper): footsteps, item pips, a growl when the bear closes, fire crackle, a
whistle, dusk/dawn cues, and win/lose jingles. It unlocks on your first
keypress (browser autoplay rules) and remembers your choice; type **`sound`**
to toggle it.

**Screen shape.** The default is the period-correct **4:3 EGA** display. On a
phone, type **`screen`** for an optional **portrait** mode — a tall 9:16 EGA
screen that fills the device, turning the extra height into more visible log.
The choice is remembered, and the title screen suggests it on portrait phones.

```
look (l) · examine <thing>      study your surroundings, or an item
north south east west (n s e w) travel one cell
climb [tree]                    scout: bearing to the station & bear (a hill sees farther)
take · inventory (i)            pick up gear / check your pack
drink · fill canteen            water — stand on a stream (~)
eat · forage · fish             food — rations, berry patches (%), or fishing at water
make fire                       warmth, a bear-ward, and a rescue signal
use binoculars · blow whistle · use flare · bandage
rest · legend · sound · palette · restart · menu
```

### The systems

- **Water is the clock.** Thirst falls every turn. Find a stream (`~`), `drink`,
  and grab the **canteen** so you can drink on the move. Rain? Tip your head back.
- **Day & night.** Eight turns of daylight, then a long cold night. After dark
  you lose **warmth** unless you're in the **cave** (`n`), sitting by a **fire**,
  or wrapped in the **blanket**. Warmth at zero means hypothermia. A **lantern**
  lets you see (and act) in the dark.
- **Weather.** Clear, **fog** (short sight, harder to spot the bear or the
  smoke), **rain** (douses fires, but you can catch a drink), and **storms**
  (bitter cold, no climbing).
- **The bear hunts by smell.** It wanders, then closes in once you're inside its
  sensing range — wider at night, narrower in the rain. Tracks and a growl are
  your warning. A **fire** or the **cave** turns it away; the **whistle** scares
  it off; the **flint** or **knife** save you if it corners you.
- **Terrain.** Streams, **hills** (`^`, climb them for a wide reveal), **clearings**
  (`"`, a fire here is seen for miles), **berry patches** (`%`, forage), a **cave**
  (`n`, shelter), and **ravines** (`V`, impassable without a **rope**).
- **Trail events.** New ground may turn up an abandoned pack, a snake, deadfall
  that twists an ankle, or a hiker's journal that points the way.

### Winning

Reach the station on foot, **signal it with a fire** within a couple of cells
(or from a clearing), or fire a **flare** near it. Score rewards speed, gear
found, ground covered, and health left — and is higher on the harder modes.
High scores and your current run are saved in the browser (`continue` on the
title screen).

Findable gear (15 items): trail rations, canteen, binoculars, flint & steel,
tattered map (reveals everything), first-aid kit, hunting knife, rope, brass
compass (permanent HUD bearing), tin whistle, signal flare, wool blanket, oil
lantern, and fishing line.

### Difficulties

- **Day Hike** — forgiving; you start with a canteen & map.
- **Backcountry** — the intended experience.
- **Survivalist** — scarce water, a keener bear, long nights, less gear.

## Colour & accessibility

The default palette is *EGA-adjacent*, not the exact EGA hardware colours: it
draws from the same high-intensity EGA hue families (light green, light red,
light cyan, light magenta, yellow, white) but tuned brighter/softer for a
phosphor-CRT glow and for contrast. The "EGA 640×350" nameplate is period flavour.

Type **`palette`** (on the title screen or in-game) to switch to a **true-EGA
mode**: the exact 16-colour hardware values on black, with the phosphor glow
turned off — authentic, if lower-contrast. The choice is remembered. To stay
usable it uses the high-intensity half of the palette, so glyph/text colours
still land ≥4:1 on black (most ≥6.7); only the dark-grey dividers dip below,
which is the inherent cost of the real hardware colours.

All text and map-glyph colours meet **WCAG 2.1 AA** contrast (≥4.5:1) against the
screen background — most clear AAA (≥7:1); only the decorative dividers sit lower
(3.55:1, above the 3:1 UI floor). Information is never carried by colour alone —
every map feature has a distinct glyph (`≈ ^ _ % n V R B @`), and reduced-motion
preferences disable the scanline flicker and text fade.

## Files

Plain static site — the lab980 house shape, no build step:

- `index.html` — the monitor/bezel + EGA-proportioned screen (HUD, log, prompt, keypad)
- `styles.css` — the CRT / green-phosphor theme, sized as a 4:3 EGA display
- `main.js` — the whole game: world generation, turn engine, bear AI, parser, save/score
- `fonts/` — the bundled **Px437 IBM VGA** text-mode font (the real DOS
  letterforms), served locally so there are no external requests. It's from
  VileR's *Ultimate Oldschool PC Font Pack* (CC BY-SA 4.0); see
  `fonts/NOTICE.txt` for attribution and the small cmap tweaks made.

## Deploying (lab980 droplet)

Served like every other lab980 subdomain — nginx static files behind certbot.
From the lab980 repo's `bin/`:

```bash
provision-site forest ivjames/forest      # DO DNS + /var/www/forest + nginx + TLS
```

No build step, so the web root can be the git clone itself and updates are a
`git pull`. It ends up at **forest.lab980.com**.
