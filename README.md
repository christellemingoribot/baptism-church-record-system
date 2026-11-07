
# AI-Based Church Baptism Record Keeping System

Updated with separate public user accounts, a private administrator sign-in page, role-based access control, and a refreshed responsive interface.

## Access levels

- **Registered user:** Can sign in and view the baptism registry and certificates. User accounts are read-only.
- **Administrator:** Signs in through `/admin-portal`. The administrator can add, edit, and delete baptism records and generate the AI summary.

The server checks permissions on every protected API request. Hiding buttons in the browser is not the only security control.

## Setup

1. Keep your existing `.env` file from your previous project. Do not replace your MongoDB connection string or database name.
2. If you need a reference, copy `.env.example` to `.env` and fill in your existing MongoDB settings and administrator credentials.
3. Open a terminal in this project folder.
4. Run `npm install`.
5. Run `npm start` (or `npm run dev`).
6. Open `http://localhost:3000` to register a regular user account and sign in.
7. Open `http://localhost:3000/admin-portal` to sign in as the administrator using the existing `ADMIN_EMAIL` and `ADMIN_PASSWORD` values in `.env`.

## MongoDB

The existing MongoDB database name and `baptism_records` collection are retained. A separate `system_users` collection is added for registered user accounts. Passwords are stored as bcrypt hashes, never as plain text. Existing baptism records are not migrated or deleted.

## Important

Keep `.env` private and do not upload it to GitHub. The downloadable project intentionally does not include your private `.env` file or `node_modules`; install dependencies with `npm install` on your computer.


## Responsive UI and logo update

The public login/dashboard, administrator sign-in, tables, forms, dialogs, and certificate controls include responsive layout rules for desktop, tablet, and mobile. The logo is stored at `public/logo.png` and the browser-tab icon at `public/favicon.png`. Keep both files when deploying. The project archive does not include `.env`, `.git`, or `node_modules`.

## Complete system enhancements

- Modern navy/blue responsive workspace styling and page transitions.
- Baptism ceremony scheduling. Administrators can create/delete schedules; signed-in users can view them.
- Administrator activity history for baptism record create/update/delete, schedule changes, and backup/restore actions.
- Notification center based on recent registry activity.
- Admin-only JSON backup and additive restore. Restore never deletes or overwrites existing baptism records.
- Public certificate verification at `/verify.html?certificate=CERTIFICATE_NUMBER` and a QR code on generated certificates (the QR renderer is loaded from cdnjs, so internet access is required for QR rendering).
- Existing records remain in `baptism_records`; new supporting collections are `admin_audit_logs` and `baptism_schedules`.

### Safe upgrade notes

1. Keep the existing `.env` values on your own computer. The distributed ZIP intentionally omits `.env`, `.git`, and `node_modules`.
2. Back up your MongoDB database before deploying any application update.
3. The backup/restore page exports baptism records only. It intentionally excludes user password hashes and session data. Restore is additive to avoid replacing existing records.
4. Admin-only functions are enforced by server middleware, not just by hidden interface controls.
5. If a real credential was included in an uploaded archive or committed to a repository, rotate it before production deployment.
6. After extracting the updated project, run `npm install`, then `npm start`. Keep your current `MONGODB_URI`, `DB_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD_HASH` values in your local `.env`.
