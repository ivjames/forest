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

- **Steam overlay / achievements**: needs the Steamworks SDK bridged into
  Electron ([steamworks.js](https://github.com/ceifa/steamworks.js) is the
  maintained binding). Achievements are a real wishlist/visibility boost;
  natural fits: *Rescued* (win), *Day Hiker / Backcountry / Survivalist* (win
  per difficulty), *Pack Rat* (all 15 items), *Bear Aware* (survive a bear
  encounter), *Firestarter* (signal fire rescue).
- **Steam Deck**: it's a keyboard game; Deck's on-screen keyboard works but a
  "Playable" (not "Verified") rating is the realistic outcome.
- **Demo**: the web version *is* the demo — but note Valve doesn't allow the
  store page to link off-site to play it. Keep forest.lab980.com as your own
  marketing channel instead.

## Gotchas that fail review (all already handled here)

- Launching into a broken resolution → wrapper starts fullscreen at native res.
- App phoning home → the game makes zero network requests.
- Missing launch options per platform → step above.
- Screenshots that aren't real gameplay → ours are actual captures.
- Capsules with marketing text → ours carry only the title + tagline.
