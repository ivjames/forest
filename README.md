# Lost in the Forest 🌲

A DOS-era text adventure, reborn as a green-phosphor browser terminal.

You wake face-down in the pine duff with no memory of how you got there. A
**10×10 grid of asterisks** is the forest around you; `@` is you. Somewhere out
in the trees is a **ranger station** — reach it and you're rescued. Somewhere
out there is also a **bear**. Thirst and hunger are ticking down the whole time.

Play it by typing commands, just like 1985.

## Playing

Open `index.html` in any browser — no build, no server, no dependencies.

```
> look                 study your surroundings (water, smoke, tracks, loot)
> north / south / east / west   (or n s e w) — travel one cell
> climb tree           scout: get a compass bearing to the station and the bear
> take                 pick up whatever is at your feet
> inventory (i)        check your pack
> drink                drink from a stream you're standing on (or your canteen)
> fill canteen         refill the canteen at water
> eat                  eat trail rations
> use binoculars       scan the distance without climbing
> make fire            ward off the bear, or signal for rescue near the station
> bandage              use the first-aid kit
> rest                 wait a turn
> help                 full command list
> restart              new forest
```

### How to survive

- **Water is the clock.** Thirst falls every turn. Find the stream (`~` on the
  map, or "you hear running water"), `drink`, and grab the **canteen** so you can
  drink on the move.
- **Climb for a heading.** A `climb tree` (or `use binoculars`) gives you the
  compass bearing to the station so you're not wandering blind.
- **The bear hunts by smell.** Get within a few cells and it closes in. Fresh
  tracks and a growl are your warning. `make fire` (needs the **flint & steel**)
  keeps it off you; a **hunting knife** helps if it corners you.
- **Signal fire wins too.** Light a fire within two cells of the station and the
  rangers see your smoke.

Findable gear, scattered on the grid: trail rations, canteen, binoculars,
flint & steel, a tattered map (marks the station), first-aid kit, hunting
knife, and a coil of rope.

## Files

Plain static site — the lab980 house shape (no build step):

- `index.html` — the terminal shell (HUD + log + prompt)
- `styles.css` — the CRT / green-phosphor theme
- `main.js` — the whole game: world generation, turn engine, parser

## Deploying (lab980 droplet)

Served exactly like every other lab980 subdomain — nginx static files behind
certbot. From the lab980 repo's `bin/`:

```bash
provision-site forest ivjames/forest      # DO DNS + /var/www/forest + nginx + TLS
```

Because there's no build step, the web root can be the git clone itself and
updates are a `git pull` (or an `update.sh` like the apex site). It ends up at
**forest.lab980.com**.
