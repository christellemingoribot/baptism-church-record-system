# Admin-Only Add Record System

Ang proyektong ito ay nagpapakita kung paano i-restrict ang pag-add ng record para **Admin lamang** ang makagawa nito.

## Project Structure
- `server.js` - Backend with `verifyAdmin` middleware on `POST /api/records`
- `public/index.html` - Frontend UI that hides the Add Record button/form for non-admin users

## How to Run
1. Install dependencies:
   ```bash
   npm init -y
   npm install express
   ```
2. Run the server:
   ```bash
   node server.js
   ```
3. Open browser at `http://localhost:3000`
