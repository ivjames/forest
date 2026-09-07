# Releasing Lost in the Forest '88 on Steam

> Named with the '88 to distinguish it from an unrelated 2017 Steam game
> called "Lost in the Forest" — and because the BIOS boot screen already
> says (C) 1988.

Yes — it really is $100. This is the whole path from "I have a browser game"
to "it's on Steam", with everything this repo already has prepared for you.

## What's already done in this repo

| Piece | Where | What it is |
|---|---|---|
| Desktop app | `desktop/` | Electron wrapper — the game unchanged, fullscreen, offline, F11/Alt+Enter toggles. `npm run package:all` produces the Windows/Linux/macOS builds Steam ships. |
| App icons | `desktop/build/` | `icon.ico` (Windows), `icon.icns` (macOS), `icon.png` |
| Store art | `steam/store_assets/` | Every required capsule at Valve's exact sizes, library assets, page background, community + client icons |
| Screenshots | `steam/store_assets/screenshots/` | Six real 1920×1080 gameplay captures (Steam requires ≥5) |
| Upload config | `steam/app_build.vdf` + `steam/upload.sh` | SteamPipe build script — fill in your app/depot ids and run it |
| Store copy | `steam/store_page.md` | Ready-to-paste description, short description, and tag suggestions |

## What only you can do (the paperwork)

1. **Create a Steamworks account** at
   [partner.steamgames.com](https://partner.steamgames.com) using your normal
   Steam account (make one if needed — it must have spent $5+ on Steam at some
   point, i.e. not be limited).
2. **Pay the $100 Steam Direct fee.** It's per game, and it's **refunded once
   the game earns $1,000 gross** on Steam. Company name: you can publish as an
   individual — use your legal name where it asks; the public "developer" name
   on the store page can be anything (e.g. "lab980").
3. **Identity + tax + bank verification** (W-9 for US, handled inside the
   onboarding flow; payouts need a bank account). This is the slowest,
   most annoying part — start it first. Valve also enforces a
   **30-day waiting period** after the fee clears before you can release.
4. **Create the app** in Steamworks. You'll be assigned an **App ID** —
   put it in `steam/app_build.vdf` (depots below).

## Store page (can go live while you wait)

1. In Steamworks → your app → **Edit Store Page**:
   - Upload everything in `steam/store_assets/` into the matching slots
     (Basic Info → Graphical Assets). Names include the sizes so it's obvious
     which goes where.
   - Upload the six screenshots; mark at least four "suitable for all ages"
     (all six are — it's a text game).
   - Paste the copy from `steam/store_page.md`.
   - Pricing: for a small retro game, $2.99–$4.99 is the usual honest band;
     you set the final price in the Pricing tab.
   - Content survey: no mature content (mild peril from an ASCII bear).
2. Submit the page for review (**2–3 business days** typically). Once
   approved, **publish it as "Coming Soon"** — Valve requires the page to be
   public for **at least 2 weeks** before launch, and it overlaps the 30-day
   fee wait. Wishlists start accruing immediately, so publish early.

## The build

Steam doesn't take a URL — it ships binaries. The Electron wrapper turns the
game into those binaries without touching the game itself.

```bash
cd desktop
npm install
npm start                # play it locally to sanity-check
npm run package:all      # -> desktop/out/<three platform dirs>
```

Notes:
- `npm run package:mac` builds an unsigned universal .app. Steam **does not
  require notarization** for games shipped through Steam, so this is fine.
  (Building the mac target from Windows/Linux works — it's just a file copy.)
- Linux: ships as-is; Steam Runtime covers Electron's needs.
- Saves: the game uses localStorage; Electron persists it per-user
  automatically. Nothing to configure.

### Depots & launch options (Steamworks → SteamPipe / Installation)

1. Create three depots (Windows, Linux, macOS). The first defaults to
   App ID + 1; make the others + 2 and + 3 to match `app_build.vdf`, or edit
   the vdf to whatever you're assigned.
2. Fill the four ids into `steam/app_build.vdf`.
3. Under **Installation → General Installation**, add one launch option per OS:
   - Windows: executable `Lost in the Forest '88.exe`
   - Linux: executable `Lost in the Forest '88`
   - macOS: executable `Lost in the Forest '88.app`
4. Install [steamcmd](https://developer.valvesoftware.com/wiki/SteamCMD), then:

```bash
cd steam
./upload.sh <your_steam_account>
```

5. In Steamworks → SteamPipe → **Builds**, the upload appears on the `beta`
   branch. Install it through the Steam client yourself (App → Properties →
   Betas), make sure it launches, then **promote the build to `default`**.

### Publishing from a headless droplet (no Mac/PC needed)

The whole pipeline runs on a plain Ubuntu droplet over SSH — packaging is
file copying and steamcmd is a terminal program. From an iPad, SSH in and:

```bash
# One-time: steamcmd needs 32-bit libs. On Ubuntu:
sudo dpkg --add-architecture i386
sudo add-apt-repository -y multiverse && sudo apt update
sudo apt install -y steamcmd
# (If apt can't find it, the manual install is a tarball:
#  mkdir ~/steamcmd && cd ~/steamcmd &&
#  curl -sqL https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz | tar zx
#  ...then use ~/steamcmd/steamcmd.sh wherever these docs say steamcmd.)

# One-time: clone SEPARATELY from the live site. /var/www/lostintheforest88
# is the deployed web root and tracks main — don't build Steam packages in it.
git clone https://github.com/ivjames/forest.git ~/forest-steam
cd ~/forest-steam/steam
./upload.sh <your_steam_account>
```

Notes for headless use:

- **Steam Guard works over SSH.** The first `steamcmd +login` asks for your
  password and then the Guard code — read the code from the Steam mobile app
  (or your email) and type it into the terminal. steamcmd caches the session,
  so later uploads don't prompt.
- **Resources:** the three platform builds total ~700 MB in `desktop/out/`;
  make sure the droplet has a couple of GB free. Node 18+ is required (the
  droplet already runs Node sites, so likely fine).
- **Testing without a desktop:** you can't run the Steam client on a droplet
  or an iPad, so you can't self-install the beta branch. Mitigations, in
  order of usefulness: the wrapper in this repo was already launch-tested on
  Linux; Valve's release review runs the game on real machines anyway; and if
  you want a pre-review sanity check, a friend with any Windows PC can be
  gifted a beta key from Steamworks in one click.

## Review & launch

1. With store page + build + pricing done, request the **release review**
   (Valve runs the game; takes ~1–5 days). Fix anything they flag and resubmit.
2. After approval, the 30-day and 2-week clocks elapsed, hit the green
   **Release** button. That's it — total cash outlay: **$100**, refundable at
   $1k gross.

Realistic timeline from today: **4–6 weeks**, almost all of it waiting on
Valve's clocks — the actual work is a few hours because it's sitting in this
repo already.

## Optional polish (not needed to ship)

- **Achievements — already wired.** The desktop shell bridges
  [steamworks.js](https://github.com/ceifa/steamworks.js) (with the Steam
  overlay enabled), and the game fires these unlocks. Register each API name
  in Steamworks → your app → **Achievements** before shipping the build:

  | API name | Display name suggestion | Earned by |
  |---|---|---|
  | `ACH_RESCUED` | Rescued | Winning any run |
  | `ACH_DAY_HIKE` | Day Hiker | Winning on Day Hike |
  | `ACH_BACKCOUNTRY` | Backcountry | Winning on Backcountry |
  | `ACH_SURVIVALIST` | Survivalist | Winning on Survivalist |
  | `ACH_BEAR_AWARE` | Bear Aware | Winning a run in which the bear reached you |
  | `ACH_FIRESTARTER` | Firestarter | Being rescued via your signal fire's smoke |
  | `ACH_PACK_RAT` | Pack Rat | Holding every piece of gear at once |

  Off Steam (the web version, dev runs) the hooks no-op silently. To test in
  dev, drop a `steam_appid.txt` containing your App ID next to the packaged
  executable and launch while the Steam client is running.
- **Quit**: the desktop build has a real `quit` command (and pad verb) that
  closes the window; on the web it returns to the title screen.
- **Steam Deck**: the controller verb bar (d-pad moves, A opens a SCUMM-style
  verb strip, X/Y/RB hit look/climb/take) makes the game completable pad-only,
  which is the main Deck requirement — "Playable" should be safe and
  "Verified" is plausible if the text passes Valve's legibility check at
  1280×800. Typing on the keyboard remains the native mode.
- **Demo**: the web version *is* the demo — but note Valve doesn't allow the
  store page to link off-site to play it. Keep lostintheforest88.com as your
  own marketing channel instead.

## Gotchas that fail review (all already handled here)

- Launching into a broken resolution → wrapper starts fullscreen at native res.
- App phoning home → the game makes zero network requests.
- Missing launch options per platform → step above.
- Screenshots that aren't real gameplay → ours are actual captures.
- Capsules with marketing text → ours carry only the title + tagline.
