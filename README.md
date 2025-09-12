# Wedding Website — Fullstack (Vite React + Express + MongoDB)

This project contains a modern wedding website:
- Frontend: React + Vite (deploy to Vercel)
- Backend: Express + GridFS (deploy to Render)
- Database: MongoDB (Atlas recommended)

Important environment variables (backend `.env`):
- MONGO_URI - your MongoDB connection string
- JWT_SECRET - JWT secret
- ADMIN_INIT_PASSWORD - initial admin password (default `admin123`)
- RESET_SECRET_KEY - secret key used to reset password via admin reset endpoint

Admin:
- Default admin username: `User1`
- Default password: `admin123` (or set via ADMIN_INIT_PASSWORD)

Admin panel:
- Frontend route: `/admin` (no link from homepage)
- Admin dashboard at `/admin/dashboard` after login

Features:
- Upload images/videos (saved to MongoDB GridFS). Files require moderator approval.
- Admin can approve files, delete files, manage guest list.
- QR code scanner in admin page to verify guest invitations (QR content should be "First Last").

How to run locally:
1. Start MongoDB or use Atlas and set `MONGO_URI`.
2. Backend:
   - `cd backend`
   - `npm install`
   - create `.env` from `.env.example`
   - `npm run dev` (or `npm start`)
3. Frontend:
   - `cd frontend`
   - `npm install`
   - `npm run dev`
4. In development, configure a proxy in Vite or run backend on the same domain. For quick testing, you can set `vite` to proxy `/api` to `http://localhost:5000` by editing `vite.config.js`.

Deploy notes:
- Render: Create a Web Service for the backend, set environment variables.
- Vercel: Import the frontend (build command `npm run build`, output `dist`) and set rewrites so `/api/*` proxied to your Render backend domain, OR configure the frontend to call the Render backend absolute URLs.

This ZIP was generated automatically. Enjoy!
