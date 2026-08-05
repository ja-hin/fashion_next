# Deploying AImageGen to a Hostinger VPS

Node.js + MongoDB, both on one box, behind nginx. This replaces the old
FastAPI/uvicorn/SQLite setup.

Placeholders to replace as you go:

- `YOUR_VPS_IP` — the server IP from Hostinger hPanel
- `yourdomain.com` — a domain pointed at the VPS (needed for HTTPS)
- `deploy` — the Linux user the app runs as

---

## 0. Before you start

- **Rotate your Gemini API key** at https://aistudio.google.com/ — the old one
  has been sitting in the repo.
- Decide a strong **admin password**.
- Point a **domain** at the VPS (an A record → `YOUR_VPS_IP`) if you want HTTPS.
  Log-in cookies are only fully safe over HTTPS, and the app marks the session
  cookie `Secure` in production — meaning **login will not work over plain HTTP
  in production**. Get the certificate sorted.

---

## 1. Create the VPS

hPanel → **VPS** → **Ubuntu 24.04 LTS** (plain OS, no panel). Note the IP.

Sizing: 2 vCPU / 8 GB RAM is comfortable. Image generation is I/O-bound waiting
on Google, but `sharp` wants a little headroom, and MongoDB likes RAM.

---

## 2. User + firewall

```bash
ssh root@YOUR_VPS_IP

adduser deploy
usermod -aG sudo deploy

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

From here on, work as `deploy`:

```bash
su - deploy
```

---

## 3. Install Node, MongoDB, nginx

```bash
# Node 22 LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# MongoDB 7
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc \
  | sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" \
  | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org nginx

sudo systemctl enable --now mongod
sudo systemctl enable --now nginx

# pm2 keeps the app running and restarts it on boot
sudo npm install -g pm2
```

**MongoDB binds to 127.0.0.1 by default — leave it that way.** The app talks to
it over localhost; it should never be reachable from the internet. Confirm:

```bash
grep bindIp /etc/mongod.conf     # expect: bindIp: 127.0.0.1
```

---

## 4. Get the code up

```bash
sudo mkdir -p /var/www/aimagegen
sudo chown deploy:deploy /var/www/aimagegen
cd /var/www/aimagegen

git clone YOUR_REPO_URL .
cd vdofy-next
npm ci
```

Generated images live outside the repo so a deploy can never wipe them:

```bash
sudo mkdir -p /var/lib/aimagegen/data
sudo chown -R deploy:deploy /var/lib/aimagegen
```

---

## 5. Configure

```bash
cp .env.example .env
nano .env
```

Production values:

```ini
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DB=aimagegen

GEMINI_API_KEY=your-freshly-rotated-key

ADMIN_EMAIL=you@yourdomain.com
ADMIN_PASSWORD=a-long-random-password

STORAGE_DRIVER=local
DATA_DIR=/var/lib/aimagegen/data

NODE_ENV=production
PORT=8080

# ── Payments (Razorpay) ──
# Live keys. Never commit these — .env is gitignored, .env.example is NOT.
RAZORPAY_KEY_ID=rzp_live_xxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=a-long-random-string-you-invent

# ── Invoicing ──
# A tax invoice legally needs these. Leave SELLER_GSTIN blank if you are not
# GST-registered — invoices then omit tax lines instead of inventing a split.
SELLER_NAME=Your Registered Company Pvt Ltd
SELLER_ADDRESS=Street, City, State, PIN
SELLER_GSTIN=
SELLER_PAN=
SELLER_EMAIL=billing@yourdomain.com
SELLER_STATE=Maharashtra
INVOICE_PREFIX=INV
```

```bash
chmod 600 .env      # it holds your API key and payment secrets
```

### Razorpay webhook

Once the site is live over HTTPS, add the webhook in the Razorpay dashboard —
**Settings → Webhooks**:

- URL: `https://yourdomain.com/api/razorpay/webhook`
- Secret: the same `RAZORPAY_WEBHOOK_SECRET` you set above
- Active events: `payment.captured` and `payment.failed`

This is not optional. The browser-side confirmation only fires if the user stays
on the page — a customer who pays and immediately closes the tab is credited
**only** by this webhook.

---

## 6. Migrate your existing data

Only if you're coming from the Python app. Upload the old `vdofy_app` folder
(or at least its `data/` directory) to the server first, then:

```bash
cd /var/www/aimagegen/vdofy-next

# Look before you leap
node scripts/migrate.mjs --from /path/to/old/vdofy_app --dry-run

# For real
node scripts/migrate.mjs --from /path/to/old/vdofy_app --copy-files
```

Everyone's password still works — the hashing scheme is unchanged.

Verify:

```bash
mongosh aimagegen --quiet --eval '
  print("users  " + db.users.countDocuments());
  print("shoots " + db.shoots.countDocuments());
  print("models " + db.models.countDocuments());
  print("logs   " + db.logs.countDocuments());'
```

---

## 7. Build and start

```bash
npm run build
pm2 start npm --name aimagegen -- start
pm2 save
pm2 startup        # run the command it prints, to survive reboots
```

Check it:

```bash
pm2 logs aimagegen --lines 30
curl -s localhost:8080/api/me      # expect {"authed":false}
```

> **Run exactly one instance.** Generation jobs are tracked in process memory,
> so `pm2 start -i max` (cluster mode) would break progress polling — a request
> could land on a worker that has never heard of the job. One process, always.

---

## 8. nginx

```bash
sudo nano /etc/nginx/sites-available/aimagegen
```

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    # Garment uploads. The app caps images at 1400px internally, but the
    # original file can be a large phone photo.
    client_max_body_size 25M;

    location / {
        proxy_pass         http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # A 4K batch can run for several minutes — the default 60s would cut
        # the response off mid-generation.
        proxy_read_timeout    900s;
        proxy_connect_timeout 900s;
        proxy_send_timeout    900s;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/aimagegen /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

---

## 9. HTTPS

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot rewrites the nginx config and sets up auto-renewal. **Do this before
inviting anyone in** — the session cookie is `Secure` in production, so login
won't work until HTTPS is live.

---

## 10. Backups

Two things to back up, and they're different.

**The database** (small — a few MB):

```bash
sudo mkdir -p /var/backups/aimagegen
sudo chown deploy:deploy /var/backups/aimagegen

crontab -e
```

```cron
# Nightly Mongo dump at 03:00, keeping 14 days
0 3 * * * mongodump --db aimagegen --archive=/var/backups/aimagegen/db-$(date +\%F).gz --gzip --quiet && find /var/backups/aimagegen -name 'db-*.gz' -mtime +14 -delete
```

**The images** (650 MB and growing ~0.5 GB/month). A VPS disk has no
redundancy — if the box dies, they're gone. Sync them somewhere off-server.
Cloudflare R2 is ~$0.015/GB-month with no egress fees, so this costs pennies:

```bash
# after configuring rclone with an R2 remote
rclone sync /var/lib/aimagegen/data r2:aimagegen-backup --fast-list
```

Restore a database dump with:

```bash
mongorestore --db aimagegen --archive=/var/backups/aimagegen/db-2026-08-01.gz --gzip --drop
```

---

## Updating

```bash
cd /var/www/aimagegen
git pull
cd vdofy-next
npm ci
npm run build
pm2 restart aimagegen
```

Generated images are in `/var/lib/aimagegen/data`, outside the repo, so a deploy
never touches them.

---

## Troubleshooting

| Symptom | Cause |
|---|---|
| Login does nothing in production | No HTTPS. The session cookie is `Secure`; the browser drops it over plain HTTP. |
| `MongoServerSelectionError` on boot | `mongod` isn't running (`sudo systemctl status mongod`) or `MONGODB_URI` is wrong. |
| Progress bar hangs forever | More than one app instance. Run a single process, never pm2 cluster mode. |
| 502 from nginx | App crashed — check `pm2 logs aimagegen`. |
| 413 on upload | Raise `client_max_body_size`. |
| Big batch dies around 60s | `proxy_read_timeout` wasn't raised in the nginx block. |
| Images 404 after a move | `DATA_DIR` doesn't point at the folder holding `outputs/` and `models/`. |
| Banner says DEMO mode | `GEMINI_API_KEY` is empty or wasn't picked up — check `.env`, then `pm2 restart aimagegen`. |

Useful commands:

```bash
pm2 logs aimagegen          # app logs
pm2 monit                   # live CPU/memory
sudo journalctl -u mongod -n 50
df -h                       # disk — watch this as images accumulate
```
