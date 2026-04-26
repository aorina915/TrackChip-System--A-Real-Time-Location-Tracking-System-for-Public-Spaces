# TrackChip System Prototype

This workspace contains a prototype implementation of the TrackChip real-time tracking system described in the project document.

## Technologies
- Frontend: React + Vite + Leaflet + Tailwind CSS
- Backend: Node.js + Express + Socket.io
- Database: PostgreSQL + PostGIS (schema provided)
- Auth: simple credential login (demo user `admin` / `trackchip123`) + JWT-like flow

## Project structure
- `server/` - backend API with real-time updates
- `client/` - frontend dashboard
- `db/` - SQL scripts for PostgreSQL schema

## Setup
1. Ensure Node.js (18+) is installed.
2. Ensure PostgreSQL + PostGIS enabled; create database `trackchip`.
3. In `db/init.sql`, run SQL to setup tables.
4. Configure `server/.env` with DB and JWT secret.
5. Start backend:
   ```bash
   cd server
   npm install
   npm run dev
   ```
   - Configure OAuth env vars in `server/.env`:
     - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`
     - `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `MICROSOFT_CALLBACK_URL`
   - The built-in path is `/auth/google`, `/auth/microsoft`.
6. Start frontend:
   ```bash
   cd client
   npm install
   npm run dev
   ```

## Features included
- JWT login and role-based access
- Socket.io real-time updates for entity positions
- Geofence creation and breach detection
- Mapbox map view with moving entity markers + trails
- Historical recording endpoints

## Note
This prototype uses simulated location data for development. Extend with real GPS/UWB/Cel data ingestion as described in system document.
