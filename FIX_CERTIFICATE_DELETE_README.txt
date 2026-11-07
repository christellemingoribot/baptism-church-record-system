BAPTISM CHURCH RECORD SYSTEM - CERTIFICATE AND DASHBOARD FIX

Changes:
- Certificate heading now uses "FAITH • RECORD • PRESERVE" instead of the church name stored on each baptism record.
- Increased the religious watermark visibility in the certificate preview.
- Added an Actions column and admin-only Delete button to Recent Baptism Records on the dashboard.
- Dashboard Delete uses the existing backend DELETE endpoint and confirmation dialog.
- The normal Baptismal Records page keeps its existing Edit/Delete controls.

Install:
1. Back up your current project first.
2. Extract this ZIP.
3. Copy public/index.html into your existing project's public/index.html.
4. Ensure public/religious-watermark.png exists in your project (the file is included).
5. Keep your current .env and Git repository. Do not upload .env.
6. Test locally with npm start and log in as an admin.
7. Confirm the dashboard delete action and certificate preview before pushing to GitHub.

Note: This package was syntax-checked with Node.js for inline scripts. Live MongoDB and Render deployment were not tested.
