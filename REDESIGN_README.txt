BAPTISM CHURCH RECORD SYSTEM — REFERENCE-BASED REDESIGN

This project redesigns the UI around the supplied reference image: navy-blue sidebar, church dashboard banner, statistics cards, baptism record table, and navigation for the main modules.

CHANGES
- Reworked the authenticated application layout to use a navy sidebar and white top header.
- Added dashboard with recent records, totals, and AI summary panel.
- Added navigation pages for Baptismal Records, New Registration, Certificate Upload preview, Generate Certificate, Search, Reports & Statistics, Certificate Verification, User Management, and Settings.
- Added dynamic reports from the records currently returned by the backend and CSV export.
- Added certificate-number lookup against records loaded from the backend. This checks for a matching record; it is not a cryptographic certificate authenticity check.
- Expanded baptism record fields: place of birth, gender, father, mother, godfather, and godmother.
- Updated server create/update/search handling for the new record fields.
- Kept existing account registration/login, record APIs, and certificate generation flow.

IMPORTANT FEATURE LIMITATIONS
- Certificate Upload currently previews a selected file in the browser only. It does NOT store the file on the server or in MongoDB because a secure upload/archive API is not part of the supplied backend.
- User Management is an information page only. The supplied backend does not expose admin APIs to list/edit/delete users.
- Settings displays system/session information only. Database backup/restore and church profile editing are not implemented in the supplied backend.
- Reports use the records currently returned by /api/records (up to the backend's existing limit), not a separate analytics endpoint.

INSTALL
1. Make a backup of your existing project.
2. Extract this ZIP.
3. Copy the extracted project files into your existing project folder, replacing files when prompted. Keep your local .env file safe; this ZIP intentionally excludes .env, .git, and node_modules.
4. Run `npm install` in the project folder.
5. Run `npm start` and test login, registration, adding/editing records, certificate generation, reports, and certificate verification.
6. If local testing succeeds, commit and push your changes to GitHub; Render should redeploy on push if auto-deploy is enabled.

CHECKS PERFORMED
- `node --check server.js`
- JavaScript syntax checks for the inline scripts in public/index.html
- JSON parse check for package.json

The live MongoDB connection, real login, file upload persistence, and Render deployment were not tested from this environment.
