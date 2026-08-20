// Copy the web game (repo root) into desktop/game/ so the packaged app is
// self-contained. Run automatically by the npm scripts; game/ is gitignored.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const dest = join(here, 'game');

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
for (const f of ['index.html', 'styles.css', 'main.js', 'fonts']) {
  cpSync(join(root, f), join(dest, f), { recursive: true });
}
console.log('synced game files into desktop/game/');
