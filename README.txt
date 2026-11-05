BAPTISM CERTIFICATE FEATURE - INSTALLATION

1. Back up your current project first.
2. Copy the updated public/index.html and public/app.js into your existing public folder.
3. Add public/certificate.css to the same folder. The updated index.html already links to it.
4. Keep your existing public/style.css, server.js, .env, and MongoDB configuration. The certificate feature is generated in the browser and does not require a new npm package or database migration.
5. Restart the app (Ctrl+C, then npm start or node server.js).
6. Sign in. In the Registry table, click Certificate beside a child's record.
7. Optional: upload a PNG/JPG/WEBP blank certificate background (max 5 MB), then click Print certificate. For best results, use an A4 landscape background with no preprinted child details.

NOTES
- The uploaded background image is kept only in the current browser session; it is not uploaded to MongoDB or saved permanently.
- The system automatically fills the child's name, birth date, baptism date, parents/guardian, church, minister, and certificate number from the saved record.
- Check all details and obtain church authorization/signatures before issuing an official certificate.
- In the print dialog, choose A4, Landscape, and enable background graphics if you are using an uploaded design.
