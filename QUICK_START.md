# 🚀 TrackChip Quick Start Guide

## ⚡ Get Started in 2 Minutes

### 1️⃣ Start the Backend Server
```bash
cd server
node index.js
```
✅ Server will start on **http://localhost:4000**

You should see:
```
✅ PostgreSQL connected
✅ Database tables verified/created
🚀 Server running → http://localhost:4000
```

### 2️⃣ Start the Frontend Client
*In a new terminal*
```bash
cd client
npm run dev
```
✅ Client will start on **http://localhost:5173**

Open your browser to: **http://localhost:5173**

---

## 📝 First-Time Setup

### Register a New Account
1. Click **"Create Account"** on the login screen
2. Enter username, password, and email
3. Click **Register**
4. You'll be logged in automatically

### Load Demo Entities
1. Click **"Load Demo Entities"** button (top right)
2. Watch 5 demo entities appear on the map
3. Entities move in real-time automatically

---

## 🎮 Common Tasks

### ➕ Add a New Entity
1. Click **"➕ Add New Entity"** button
2. Fill in:
   - **Entity Label**: e.g., "Bob Smith", "Truck #42"
   - **Entity Type**: person, vehicle, asset, or device
   - **Coordinates**: Auto-detected or manual entry
3. Click **Create Entity**

### 🔴 Draw a Geofence
1. Click **"Geofence"** tab
2. Click on the map to place polygon points
3. Click "Save Fence" to complete
4. Name your geofence
5. Done! Area is now monitored

### ⚠️ Report an Issue
1. Click any entity on the map
2. Click **"Report Issue"** in the popup
3. Select issue type (e.g., geofence_breach)
4. Add description
5. Click **Report Alert**

### 📊 View Heatmap
1. Click **"📊 Heatmap"** button (top bar)
2. Red areas show where entities spend most time
3. Click again to toggle off

### 💎 Upgrade to Premium
1. Try adding more than 4 entities on free plan
2. System shows: "Entity limit reached"
3. Click **"Upgrade to Premium"** button
4. Unlimited entities unlocked!

---

## 🔑 Test Account

Pre-seeded admin user for testing:
- **Username**: `admin`
- **Password**: `admin123`

Or create your own account!

---

## 📱 What You Can Track

| Type | Description | Icon |
|------|-------------|------|
| **Person** | Students, staff, security | 👤 |
| **Vehicle** | Cars, buses, vans, trucks | 🚗 |
| **Asset** | Packages, equipment, cargo | 📦 |
| **Device** | Phones, watches, GPS units | 📱 |

---

## 🗺️ Map Features

- **Zoom**: Use mouse wheel
- **Pan**: Click and drag the map
- **Entity Markers**: Click to see details
- **Real-time Updates**: Positions update automatically
- **Geofence Polygons**: Visible as colored boundaries

---

## 📊 Real-Time Features

- ✅ Entities move and update every few seconds
- ✅ Alerts broadcast to all connected users instantly
- ✅ Geofence violations detected in real-time
- ✅ Location history tracked for heatmaps

---

## 🛑 Troubleshooting

### Server won't start
```
Error: Cannot find module
→ Run: cd server && npm install
```

### Client blank page
```
CORS error in browser console
→ Make sure server is running on localhost:4000
```

### Can't create entities
```
"Database required" error
→ Ensure PostgreSQL is running and DB configured
```

### No entities showing
```
Try clicking "Load Demo Entities" first
→ Then entity list will populate
```

---

## 🔧 API Endpoints Quick Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Get JWT token |
| `GET` | `/entities` | List all entities |
| `POST` | `/entities` | Create entity |
| `GET` | `/geofences` | List geofences |
| `POST` | `/geofences` | Create geofence |
| `GET` | `/alerts` | List alerts |
| `POST` | `/entities/:id/report` | Create alert |
| `POST` | `/demo/entities` | Load demo data |
| `GET` | `/subscription` | Check subscription |
| `POST` | `/subscription/upgrade` | Upgrade plan |

---

## 📚 Full Documentation

See **SYSTEM_STATUS.md** for complete system documentation.

---

## ✨ That's It!

You now have a fully functional real-time entity tracking system.

**Questions?** Check the console logs for debugging info.

**Ready to track?** Open http://localhost:5173 🎯

