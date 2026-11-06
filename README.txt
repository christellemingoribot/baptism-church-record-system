# Updated Baptism Church Record System backend

## Apply these files
1. Back up your existing `server.js` and `package.json`.
2. Replace them with `server.js` and `package.json` from this ZIP.
3. In your project terminal, run:
   `npm install`
4. Confirm your environment variables are configured in your local `.env` and in Render's Environment settings.

## Required environment variables
- `MONGODB_URI` — MongoDB Atlas connection string
- `DB_NAME=church_records` (optional; defaults to `church_records`)
- `SESSION_SECRET` — a long, random secret (required in production)
- `ADMIN_EMAIL` — administrator email
- `ADMIN_PASSWORD_HASH` — bcrypt hash of the admin password (recommended and required for plain-text-free production config)
- `NODE_ENV=production` on Render
- `OPENAI_API_KEY` — optional; AI summary falls back to database-based statistics without it

Generate a bcrypt hash locally (replace `YOUR_ADMIN_PASSWORD` with your actual password; do not share the password):
`node -e "require('bcryptjs').hash('YOUR_ADMIN_PASSWORD', 12).then(console.log)"`

Copy the printed hash into `ADMIN_PASSWORD_HASH` in Render. Remove `ADMIN_PASSWORD` from Render after setting the hash. Do not commit `.env` or secrets to GitHub.

## What changed
- Adds MongoDB-backed session storage via `connect-mongo`; sessions persist across server restarts instead of using Express's in-memory session store.
- Production admin login requires a bcrypt hash instead of a plain-text admin password.
- Existing routes and MongoDB collections remain in place.

## Important
- Back up the database before changing production settings.
- The app has not been tested against your live MongoDB/Render environment from here. After deploying, check `/api/health`, test user login, admin login, and create/read/update/delete a test record before using it for real church records.
