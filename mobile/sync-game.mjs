// Copy the web game (repo root) into mobile/www/ — same pattern as
// desktop/sync-game.mjs. www/ is gitignored; run via `npm run sync`.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dest = join(here, 'www');

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const f of ['index.html', 'styles.css', 'main.js', 'fonts']) {
  cpSync(join(root, f), join(dest, f), { recursive: true });
}
console.log('synced game files into mobile/www/');
