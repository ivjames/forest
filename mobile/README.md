# Lost in the Forest '88 — mobile (Capacitor)

The same web game, wrapped for iOS and Android. `npm run sync` copies the
game from the repo root into `www/` and updates both native projects.

## Build

```bash
npm install
npm run sync
npm run open:android   # opens Android Studio -> Build > Generate Signed App Bundle
npm run open:ios       # opens Xcode (macOS only) -> Product > Archive
```

- **Android**: needs Android Studio (free). Play Console account: $25 one-time.
- **iOS**: needs a Mac with Xcode. Apple Developer Program: $99/year.
- Portrait is locked on phones (Android manifest + iPhone Info.plist); iPad
  rotates freely. Icons/splash live in `assets/` and regenerate with
  `npx @capacitor/assets generate`.
- App id: `com.lab980.lostintheforest88` (change in `capacitor.config.json`
  *before* first store upload — it's permanent once published).

## Real-device notes

- Saves use localStorage inside the app's webview — persistent, but iOS can
  evict webview storage under disk pressure; if that ever bites, bridge
  saves to @capacitor/preferences.
- The game's own VisualViewport keyboard handling is active; Capacitor's
  keyboard resize is set to `none` so it behaves like Safari. Verify the
  prompt stays visible above the keyboard on a real device first thing.
