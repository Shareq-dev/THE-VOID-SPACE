# THE VOID SPACE

THE VOID SPACE is a full-stack wallpaper sharing platform for curated dark mobile wallpapers. It gives creators a place to publish their work, build public profiles, receive badge recognition, and share original-quality wallpapers through a clean mobile-first experience.

Live app: https://thevoidspace.online/  
Info site: https://thevoidspace.info/

## Features

- Curated wallpaper gallery with admin approval before public visibility.
- Creator accounts with public profiles, profile pictures, upload statistics, and badge tiers.
- Wallpaper uploads with preview, crop/zoom controls, and 9:16 mobile-first guidance.
- Original-quality downloads for signed-in users and limited guest downloads.
- Search by wallpaper title, creator name, and `@username`.
- Image enhancement for logged-in creators with Cloudinary support and Sharp fallback.
- Feedback threads, admin replies, and platform-wide notifications.
- Public Terms of Service and Privacy Policy pages.
- Local development fallback when Supabase is not configured.

## Tech Stack

- Node.js native HTTP server
- HTML, CSS, and vanilla JavaScript
- Supabase Postgres and Supabase Storage
- Sharp image processing
- Brevo transactional email for OTP and admin alerts
- Cloudinary image enhancement when configured
- Render deployment support

## Project Structure

```text
server.js                  Main backend server and API routes
public/                    Frontend pages, styles, and browser JavaScript
supabase/schema.sql        Database schema, policies, and storage setup
render.yaml                Render deployment configuration
package.json               Node scripts and runtime dependencies
```

## Getting Started

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npm start
```

Open:

```text
http://localhost:4173
```

If Supabase environment variables are not set and the app is not running on Render, the server uses local JSON/file storage for development.

## Environment Variables

Copy `.env.example` and fill in only the values you need.

Required for production:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `THE_VOID_ADMIN_PASSWORD`
- `THE_VOID_IP_HASH_SECRET`

Optional service integrations:

- `BREVO_API_KEY` for email OTP and admin alerts.
- `CLOUDINARY_URL` for AI enhancement.
- `SUPABASE_ANON_KEY` only when Google authentication is enabled.

Do not commit real `.env` files, service keys, passwords, tokens, or private credentials.

## Database Setup

Use `supabase/schema.sql` in your Supabase project to create the required tables, indexes, policies, and storage bucket configuration.

The expected public storage buckets are:

- `wallpapers`
- `profile-pics`

## Deployment

This project includes `render.yaml` for Render deployment. Secret values are marked with `sync: false` and must be added in the Render dashboard.

Before deploying, verify:

- Supabase URL and service role key are configured.
- Storage buckets exist.
- Admin password and IP hash secret are set.
- Email and enhancement providers are configured only if you want those features enabled.

## Verification

Run a syntax check:

```bash
npm run check
```

For a smoke test, start the server and verify:

- `GET /` loads the public app.
- `GET /admin` loads the admin page.
- `GET /api/wallpapers` returns a JSON response.

## Security Notes

The app uses HttpOnly cookies, password hashing, same-origin checks for state-changing API calls, upload validation, and server-side access to private provider keys. Production deployments must provide strong secrets through environment variables.

This public repository does not include real service credentials.

## License

This project is released under the MIT License. See [LICENSE](LICENSE).

