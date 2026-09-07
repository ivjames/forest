# Deploying lostintheforest88.com

**Lost in the Forest '88** is a **static site** — no build step, no server
process, no `node_modules`. The git checkout *is* the nginx web root, so a
deploy is a `git pull`.

|  |  |
|---|---|
| Live at | **https://lostintheforest88.com** (and `www.`; port 80 redirects to 443) |
| Web root | `/var/www/lostintheforest88` — a clone of this repo, tracking `main` |
| Served by | nginx on the lab980 droplet, certbot for TLS |
| vhost | [`site/nginx.conf`](site/nginx.conf) in this repo is the source of truth |

URL layout, from `site/nginx.conf`:

| URL | File | Cache-Control |
|---|---|---|
| `/` | `site/index.html` (landing page) | `no-cache` |
| `/play/` | repo root — the game itself | `no-cache` |
| `/play/fonts/*.woff2` | `fonts/` | `public, max-age=2592000` |
| `/shots/` | `steam/store_assets/screenshots/` | `public, max-age=604800` |
| `/art/` | `steam/store_assets/` | `public, max-age=604800` |

This repo has **no operate CLI** — there is no `bin/` and no `forest deploy`.
The commands below are the whole interface.

## Redeploy (after changes land on `main`)

```bash
cd /var/www/lostintheforest88
git status -sb          # MUST read: ## main...origin/main   (see below if it doesn't)
git pull
```

That's it — static files, so nginx serves the new versions immediately. No
build, no restart, no pm2. HTML/CSS/JS are `no-cache`, so browsers revalidate
on every load and a plain reload shows the new version (no hard refresh needed,
which matters on iOS/Safari where there isn't one).

## Verify what is actually live

A 200 only proves nginx answered; it says nothing about *which* build. Compare
the served file against the commit you expect, byte for byte:

```bash
# from anywhere with a clone
curl -s https://lostintheforest88.com/play/main.js | git hash-object --stdin
git rev-parse main:main.js
```

Two identical hashes mean the deploy landed. They are blob hashes of the same
file, so this works for any tracked file — `index.html`, `styles.css`, a font.
Do this before saying a change shipped.

## If `git pull` says "Already up to date" but the site is stale

**This is the failure mode to expect**, and it is silent — `git pull` is
telling the truth about a branch that isn't `main`. It happened on 2026-09-07:
the web root sat on `claude/steam-release-lost-forest-q6d9qq` at `78d2de2`
while `main` was five commits ahead, and every `git pull` cheerfully reported
up to date.

```bash
cd /var/www/lostintheforest88
git status -sb                      # shows the branch actually checked out
git pull origin main                # unblocks it right now

# then pin it so a bare `git pull` can't drift again:
git checkout -B main origin/main
git branch -u origin/main main
git status -sb                      # expect: ## main...origin/main
```

Pulling an explicit `origin main` fast-forwards the *current* branch, which
fixes today's deploy but leaves the checkout on the wrong branch with a stale
upstream — so the next bare `git pull` goes quiet again. Pin it to `main`.

## The vhost

`site/nginx.conf` is the deployed config. To change it, edit it here, then on
the droplet:

```bash
cp /var/www/lostintheforest88/site/nginx.conf \
   /etc/nginx/sites-available/lostintheforest88.com
nginx -t && systemctl reload nginx
```

Note that certbot rewrites the installed vhost when it issues or renews a cert
(it adds the 443 server block and the 80→443 redirect), so the installed file
is `site/nginx.conf` **plus** certbot's edits — don't expect them to match
byte for byte, and re-copying loses the TLS block until certbot runs again.

## First-time provision

> Reconstructed from the running site, not a transcript of what was run. The
> site is on its own apex domain rather than a `*.lab980.com` subdomain, so the
> lab980 `provision-site` DNS step does not apply as written — point the apex
> and `www` A records at the droplet (`165.22.128.19`) at your registrar first.

```bash
# 1. Clone main into the web root.
mkdir -p /var/www
git clone -b main https://github.com/ivjames/forest.git /var/www/lostintheforest88

# 2. Install the vhost.
cp /var/www/lostintheforest88/site/nginx.conf \
   /etc/nginx/sites-available/lostintheforest88.com
ln -sf /etc/nginx/sites-available/lostintheforest88.com \
       /etc/nginx/sites-enabled/lostintheforest88.com
nginx -t && systemctl reload nginx

# 3. TLS: issues the cert and adds the 80->443 redirect.
certbot --nginx -d lostintheforest88.com -d www.lostintheforest88.com --redirect -n
```

## Notes

- **Everything tracked is public.** The web root is the git checkout and the
  catch-all `location /` serves it, so `/README.md`, `/DEPLOY.md`, `/STEAM.md`
  and `/desktop/package.json` are all fetchable (verified). Dotfiles 404, so
  `.claude/` and `.git/` are not exposed, but `*.md` is **not** denied here —
  unlike the lab980 convention, which assumes it is. Don't commit anything you
  wouldn't publish; if that matters, add the deny rules to `site/nginx.conf`.
- **No app port / pm2:** nothing listens on an `806x` port for this site.
- **`forest.lab980.com`** is what this runbook used to describe. It no longer
  resolves; `site/nginx.conf` was added in `917fe2c` (2026-08-19) and moved the
  site to its own domain, and this file was not updated until now.
