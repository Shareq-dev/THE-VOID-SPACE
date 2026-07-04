# THE VOID SPACE

A privacy-first, dark-themed wallpaper sharing platform. Curated 9:16 mobile wallpapers, original-resolution downloads, creator profiles, AI image enhancement, and an in-app feedback thread.

Live site: [thevoidspace.online](https://thevoidspace.online) · Companion info site: [thevoidspace.info](https://thevoidspace.info)

---

## ✦ What it is

THE VOID SPACE is a small, focused platform where creators publish dark, immersive mobile wallpapers and collectors download them at original quality. Every wallpaper is reviewed before it goes public. There are no ads, no tracking, and no engagement algorithms — just the work.

- **Wallpapers** — curated 9:16 portraits, JPEG / PNG / WEBP, max 12 MB, original-quality downloads for logged-in users.
- **Guest downloads** — 2 per device per ISO calendar week, no signup required.
- **Creator profiles** — public portfolio with badge tiers (Starter / Curator / Void Creator) and upload stats.
- **AI enhancement** — three modes (Natural / Detail / Ultra) via Cloudinary, with a built-in Sharp fallback when the AI quota is spent.
- **Feedback thread** — chat-style in-app conversation between users and the admin; reviewed items prune after 7 days.
- **Notifications** — platform-wide announcements as toast popups with a unread bell indicator.
- **Privacy by default** — no tracking, scrypt password hashing, HttpOnly cookies, same-origin CSRF on every state-changing request.

---

## ✦ Tech stack

The stack is intentionally plain. No bundler, no compile step, no framework-of-the-week.

| Layer | Choice |
|-------|--------|
| Backend | Plain Node.js `http` server in a single `server.js` |
| Frontend | Static HTML / CSS / plain JavaScript in `public/` |
| Database & Storage | Supabase Postgres + Storage (Row-Level Security enabled on every table) |
| Hosting | Render |
| Transactional email | Brevo (signup OTP + admin event alerts) |
| AI image enhancement | Cloudinary (with Sharp as the local fallback) |
| Image processing | Sharp (upload validation, variants, fallback enhancement) |

Runtime dependencies total **two**: [`@supabase/supabase-js`](https://www.npmjs.com/package/@supabase/supabase-js) and [`sharp`](https://www.npmjs.com/package/sharp). That's it.

---

## ✦ Project structure

```
.
├── server.js                 # The entire backend — routes, auth, uploads,
│                             # admin, Supabase, Brevo, Cloudinary, Sharp,
│                             # security headers, local fallback.
├── render.yaml               # Render service definition + env-var list.
├── package.json
├── supabase/
│   └── schema.sql            # Tables, indexes, triggers, RLS, grants,
│                             # and Storage bucket policies.
└── public/                   # Static frontend — no build step.
    ├── index.html            # Main app page.
    ├── admin.html            # Admin console.
    ├── styles.css            # All styling (dark void theme).
    ├── app-state.js          # Shared state, session helpers, modals.
    ├── app-search-auth.js    # Signup / login / OTP, search, Google auth.
    ├── app-profile.js        # Profile UI, avatar, uploads, account.
    ├── app-editor.js         # Wallpaper upload preview + presets.
    ├── app-gallery.js        # Wallpaper grid, preview, downloads.
    ├── app-enhance.js        # Enhancement frontend flow.
    ├── app-settings.js       # Notifications and feedback UI.
    ├── app-boot.js           # Init call.
    ├── admin.js              # Admin page interactions.
    ├── script.js             # Tiny legacy loader.
    ├── terms.html            # Terms of Service.
    ├── privacy.html          # Privacy Policy.
    └── void-space-hero.svg   # Hero wordmark.
```

---

## ✦ Getting started

### Prerequisites

- Node.js 18 or newer
- A Supabase project (URL + service_role_key + a verified sender email on Brevo for OTP)
- Optional: a Cloudinary account if you want AI enhancement

### Install and run locally

```bash
# 1. clone the repo
git clone https://github.com/<your-username>/the-void-space.git
cd the-void-space

# 2. install dependencies (just two of them)
npm install

# 3. copy the env template and fill in your own values
cp .env.example .env
#   (on Windows PowerShell: Copy-Item .env.example .env)

# 4. start the server
npm start
```

The server listens on `http://localhost:4173` by default.

If `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are not set and the app is not running on Render, the server falls back to local JSON/file storage in `THE_VOID_DATA_DIR` (or a default local folder). This makes it easy to poke around without provisioning Supabase first.

### Smoke test (local fallback mode)

- `GET /` returns `200`.
- `POST /api/admin/login` requires a same-origin `Origin` header and the admin password.
- Authenticated `GET /api/admin/storage` reports `ready:true`.

---

## ✦ Environment variables

See [`.env.example`](./.env.example) for the full list with descriptions and defaults.

The short version:

- **Required for production**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `THE_VOID_ADMIN_PASSWORD`, `THE_VOID_IP_HASH_SECRET`.
- **Required if you want email OTP**: `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`.
- **Optional**: enhancement, lockout, and rate-limit tuning knobs all have sensible defaults baked into `server.js`.

**Never commit real secrets.** The `.gitignore` already excludes `.env` files.

---

## ✦ Deploy to Render

1. Fork or push this repository to your GitHub.
2. Create a new Web Service on [Render](https://render.com) and connect the repo.
3. Set the build command to `npm install` and the start command to `npm start` (or `node --expose-gc server.js` to enable manual GC under memory pressure on Render free).
4. Add every env var from `.env.example` that applies to your deploy (the `render.yaml` file pre-declares the list for the Render dashboard's "Sync from `render.yaml`" feature).
5. Deploy.

---

## ✦ Database setup

Run the SQL in [`supabase/schema.sql`](./supabase/schema.sql) in the Supabase SQL editor. This creates:

- `public.users` (creator accounts)
- `public.wallpapers` (wallpaper records + status lifecycle)
- `public.app_settings` (sessions, login locks, badge overrides, AI usage, notifications, feedback — stored as JSONB)
- Indexes on `storage_path`, `(status, created_at desc)`, `(creator_id, created_at desc)`
- RLS enabled on all three tables; `service_role` granted full access
- Storage buckets `wallpapers` and `profile-pics` with public-read policies
- `set_updated_at` triggers and a username-immutability guard

---

## ✦ Security model (short version)

- The Supabase `service_role` key lives only on the server. Browser code never receives it.
- Passwords are hashed with scrypt + per-user salt.
- Sessions use HttpOnly cookies + a server-side active-session record (one device per session).
- OTP codes are kept only as hashes in memory and cleared after use or TTL.
- Same-origin CSRF / origin check on every state-changing `/api/` request.
- Security headers: CSP, frame-block, nosniff, referrer policy, permissions policy, HSTS.
- Admin and user login lockouts with per-device tracking.
- Enhancement download tokens are session-bound and memory-only — they evaporate on Render restart or sleep.

---

## ✦ License

[MIT](./LICENSE) © 2026 Syed Roshan Shareq.

You're free to fork, study, modify, and redeploy. Keep the copyright notice. If you build something interesting on top of it, a heads-up is appreciated but not required.

---

## ✦ Author

**Syed Roshan Shareq** — sole designer, developer, and operator of THE VOID SPACE.
Live: [thevoidspace.online](https://thevoidspace.online)

The void remembers.
