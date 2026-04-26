# TrackChip System - Pre-Demo Verification Checklist

**Use this checklist 24 hours before and 1 hour before recording**

---

## 🔧 SYSTEM SETUP (Run 24 hours before)

### Database & Backend Setup
- [ ] PostgreSQL is running
- [ ] Database `trackchip` exists
- [ ] Tables created (run `db/init.sql` if needed)
- [ ] Backend dependencies installed: `cd server && npm install`
- [ ] Backend `.env` file configured with database credentials
- [ ] Backend can start without errors: `cd server && node index.js`
  - Expected output: "Server running on port 5000"
  - Check console for any error messages

### Frontend Setup
- [ ] Frontend dependencies installed: `cd client && npm install`
- [ ] Frontend `.env` configured if needed
- [ ] Frontend can start without errors: `cd client && npm run dev`
  - Expected output: "Local: http://localhost:5173"

### Network & Socket.io
- [ ] Backend and frontend can communicate
- [ ] Socket.io connection works (check browser dev tools)
- [ ] Real-time updates are flowing (watch entity positions update)

---

## ✅ FUNCTIONALITY TESTS (Run 1 hour before recording)

### Step 1: Start Both Services
```bash
# Terminal 1: Start Backend
cd c:\Users\USER\TCS-React\server
node index.js
# Wait for "Server running on port..."

# Terminal 2: Start Frontend
cd c:\Users\USER\TCS-React\client
npm run dev
# Wait for "Local: http://localhost:5173"
```

- [ ] Both services started without errors
- [ ] No port conflicts (backend on 5000, frontend on 5173)
- [ ] No console errors visible

### Step 2: Test Login
1. Open http://localhost:5173 in browser
2. Try to log in:
   - [ ] Username field accepts input
   - [ ] Password field masks input
   - [ ] Login button is clickable
   - [ ] Login succeeds with `admin` / `trackchip123`
   - [ ] Dashboard loads after login
   - [ ] No error messages appear

### Step 3: Test Dashboard
Once logged in:
- [ ] Dashboard cards display (active entities, geofences, alerts)
- [ ] Cards show reasonable numbers (not 0 or negative)
- [ ] Activity logs appear at bottom
- [ ] Data refreshes every few seconds (WebSocket working)
- [ ] No console errors in browser dev tools

### Step 4: Test Tracking Map
1. Navigate to Tracking Panel or Device Tracker
   - [ ] Map loads correctly
   - [ ] Map controls work (zoom, pan)
   - [ ] Entities display as markers on map
   - [ ] Movement trails are visible
   - [ ] Marker popups show entity info when clicked
   - [ ] Map updates in real-time (entities move smoothly)

### Step 5: Test Geofence Manager
1. Navigate to Geofence Manager
   - [ ] Geofence list loads and displays
   - [ ] Can see existing geofences
   - [ ] "Add Geofence" button works
   - [ ] Can create a test geofence:
     - [ ] Enter name
     - [ ] Draw/select boundary on map
     - [ ] Save successfully
     - [ ] New geofence appears on map
     - [ ] Geofence appears in list

### Step 6: Test Alerts Manager
1. Navigate to Alerts Manager
   - [ ] Alert list displays
   - [ ] Can see alert details when clicked
   - [ ] Alert timestamps are current
   - [ ] Can acknowledge alerts
   - [ ] Status changes after acknowledgment

### Step 7: Test Activity Logs
1. Navigate to Activity Logs
   - [ ] Chronological list displays
   - [ ] Timestamps are reasonable (recent dates)
   - [ ] Log entries update in real-time
   - [ ] Can see entity names and actions
   - [ ] Filter/search works if implemented

### Step 8: Test Device Manager
1. Navigate to Device Manager (if available)
   - [ ] Entity/device list displays
   - [ ] Can see device properties (name, ID, status)
   - [ ] Can add new device if needed
   - [ ] Status indicators show online/offline correctly

---

## 🎥 RECORDING ENVIRONMENT (15 minutes before)

### Computer & Screen
- [ ] Close all unnecessary applications
- [ ] Close all browser tabs except http://localhost:5173
- [ ] Disable notifications:
  - [ ] Windows notifications disabled
  - [ ] Browser notifications disabled
  - [ ] Chat applications minimized
- [ ] Disable screen saver
- [ ] Disable auto-lock
- [ ] Brightness set to comfortable level
- [ ] Screen resolution set to full (1920x1080 recommended)

### Camera & Microphone (for on-camera sections)
- [ ] Microphone is working (test with system sounds)
- [ ] Audio levels are appropriate (not too loud/quiet)
- [ ] Background is appropriate for academic recording
- [ ] Lighting is adequate (no glare on face)
- [ ] Camera is in focus
- [ ] Head and shoulders visible in frame

### Google Vids Access
- [ ] Logged into Google account
- [ ] Can access Google Vids (tested at google.com)
- [ ] Can create new project in Google Vids
- [ ] Screen recording permission granted

---

## 📋 DEMO SCRIPT PREPARATION (1 day before)

### Introduction Script
- [ ] Script written and practiced (time: 1 minute)
- [ ] Includes: name, program, project title, problem statement
- [ ] Reads naturally (not rushed)

### Objective Slide/Text
- [ ] Slide created or text prepared
- [ ] Explains main goal of system
- [ ] Time allotted: 1 minute

### Features List
- [ ] List of 5 key functionalities prepared
- [ ] Each feature has 1-2 sentence explanation
- [ ] Time allotted: 1 minute

### Architecture Diagram
- [ ] Diagram created showing:
  - [ ] Frontend (React)
  - [ ] Backend (Node.js/Express)
  - [ ] Database (PostgreSQL)
- [ ] Can explain each component briefly
- [ ] Time allotted: 1 minute

### Live Demo Sequence
- [ ] Sequence practiced:
  - [ ] Login & Dashboard (30 sec)
  - [ ] Real-time Tracking Map (1 min)
  - [ ] Geofence Management (1.5 min)
  - [ ] Alerts & Notifications (1 min)
  - [ ] Activity Logs (1 min)
- [ ] Time allotted: 4-5 minutes

### Conclusion Script
- [ ] Script written and practiced
- [ ] Includes: key contributions, impact, future improvements
- [ ] Reads naturally and confidently
- [ ] Time allotted: 1 minute

### Backup Plans
- [ ] Know what to do if entity won't move
- [ ] Know what to do if feature doesn't load
- [ ] Have alternate demo scenario ready
- [ ] Know keyboard shortcuts for faster navigation

---

## 🎬 FINAL CHECKS (5 minutes before recording)

### Quick System Health
- [ ] Backend running: port 5000 responding
- [ ] Frontend running: http://localhost:5173 loads
- [ ] Logged in to dashboard
- [ ] Real-time data updating (watch for movement)
- [ ] Map showing entity positions
- [ ] No console errors visible

### Final Environment Check
- [ ] Room is quiet (no background noise)
- [ ] Phone on silent
- [ ] Door closed if possible
- [ ] All notifications disabled
- [ ] Chrome/Firefox in fullscreen mode
- [ ] Only relevant tabs open

### Camera & Recording Setup
- [ ] Webcam positioned correctly
- [ ] Google Vids open and ready to record
- [ ] All scripts visible or memorized
- [ ] Deep breath—you're ready!

---

## 📊 TEST RUN (Optional but recommended)

Do a complete 10-minute test run:

**Section** | **Action** | **Time** | **✓**
---|---|---|---
Introduction | Record yourself introducing project | 1 min | [ ]
Objective | Show objective slide | 1 min | [ ]
Features | List features | 1 min | [ ]
Architecture | Show architecture | 1 min | [ ]
Demo - Login | Log in and show dashboard | 0:30 | [ ]
Demo - Map | Show tracking map | 1 min | [ ]
Demo - Geofence | Create/show geofence | 1:30 | [ ]
Demo - Alerts | Show alerts and acknowledge | 1 min | [ ]
Demo - Logs | Show activity logs | 1 min | [ ]
Conclusion | Record conclusion | 1 min | [ ]
**TOTAL** | | **10:30** | [ ]

If test run has issues:
- [ ] Fix identified problems
- [ ] Test that feature again
- [ ] Do another practice run

---

## 🚀 YOU'RE READY TO RECORD!

Before clicking "Start Recording" in Google Vids:

- [ ] All system checks passed ✓
- [ ] All functionality tests passed ✓
- [ ] Recording environment optimized ✓
- [ ] Scripts prepared ✓
- [ ] Test run completed successfully ✓
- [ ] You feel confident and ready ✓

**Time to shine! Good luck! 🎥**

---

## 📝 NOTES

**System Check Date:** _______________  
**System Status:** ✓ Ready / ⚠️ Issues Found  
**Issues Found (if any):**
```
_________________________________________________________________

_________________________________________________________________

_________________________________________________________________
```

**Test Run Completed:** Yes / No  
**Test Run Time:** _____ minutes  
**Test Run Status:** ✓ Pass / ✗ Fail  

**Ready to Record:** Yes / No  
**Recording Date:** _______________  
**Recording Time:** _______________

---

**Good luck with your demonstration! You've got this! 🌟**
