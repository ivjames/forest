# Deploying forest.lab980.com

**Lost in the Forest** is a **static site** — `index.html`, `styles.css`,
`main.js`, and `fonts/`. No build step, no server process, no `node_modules`.
It's served directly by **nginx** on the lab980 droplet, with **certbot** for
TLS. Web root: `/var/www/forest`.

> Note: the shared `provision-site` script writes an nginx vhost that
> **proxies to a local port** (the pattern for Node/pm2 apps). This site has no
> app to proxy to, so after provisioning we replace that vhost with a static
> `root` one. That's the only wrinkle.

## First-time provision (on the droplet, as root)

```bash
# 1. Clone main into the web root, then let provision-site do DNS + nginx
#    (it detects the existing clone and skips its own clone step).
mkdir -p /var/www
git clone -b main https://github.com/ivjames/forest.git /var/www/forest
provision-site forest ivjames/forest --no-tls

# 2. Replace the proxy vhost with a static one.
cat > /etc/nginx/sites-available/forest.lab980.com <<'NGINX'
server {
    listen 80;
    listen [::]:80;
    server_name forest.lab980.com;

    root /var/www/forest;
    index index.html;

    # HTML/CSS/JS: always revalidate so a `git pull` shows up immediately
    # (304 when unchanged). This avoids stale-cache surprises on iOS/Safari,
    # where there is no hard-refresh.
    location / {
        try_files $uri $uri/ =404;
        add_header Cache-Control "no-cache" always;
    }

    # Fonts are effectively immutable: cache them hard.
    location ~* \.(?:woff2?)$ {
        expires 30d;
        add_header Cache-Control "public, max-age=2592000" always;
    }
}
NGINX
nginx -t && systemctl reload nginx

# 3. TLS: waits for DNS, issues the cert, adds the 80->443 redirect.
certbot --nginx -d forest.lab980.com --redirect -n
```

Then open **https://forest.lab980.com**.

## Redeploy (after changes land on `main`)

```bash
cd /var/www/forest && git pull
```

That's it — static files, so nginx serves the new versions immediately. No
build, no restart, no pm2. With the `no-cache` headers above, browsers
revalidate HTML/CSS/JS on every load, so a plain reload shows the new version
(no hard refresh needed — which matters on iOS/Safari, where there isn't one).

## Notes

- **Default branch:** deploys track `main`. If you want `git clone`/tooling to
  default to it, set `main` as the repository's default branch in GitHub
  (Settings → General → Default branch).
- **No app port / pm2:** unlike the Node sites on this droplet, nothing listens
  on an `806x` port here; the `.env`/`PORT` that `provision-site` seeds is
  unused and harmless.
