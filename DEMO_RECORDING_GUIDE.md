# TrackChip System - Project Demonstration Recording Guide

**APT 4900 A SS 2026**  
**Based on Project Demonstration Guidelines by Dr. Stanley Githinji**

---

## Quick Reference: 10-Minute Demo Structure

| Section | Duration | Content |
|---------|----------|---------|
| Introduction | 1 min | Your name, program, project title & problem statement |
| Overall Objective | 1 min | System goals and SDG alignment |
| Key Functionalities | 1 min | Main features (4-5 key features) |
| System Architecture | 1 min | Architecture diagram & explanation |
| Live Demonstration | 4-5 mins | Hands-on walkthrough of system |
| Conclusion | 1 min | Impact, contribution & future improvements |

---

## Part 1: Recording Setup

### Step 1: Prepare Your Environment
1. Close all unnecessary applications and tabs
2. Ensure both server and client are running:
   ```bash
   # Terminal 1: Start backend
   cd c:\Users\USER\TCS-React\server
   node index.js
   # Wait for "Server running on port..."
   
   # Terminal 2: Start frontend
   cd c:\Users\USER\TCS-React\client
   npm run dev
   # Wait for "Local: http://localhost:5173"
   ```

3. Open your browser to `http://localhost:5173`
4. Log in with demo credentials:
   - **Username:** admin
   - **Password:** trackchip123

### Step 2: Access Google Vids
1. Open Google.com in your browser
2. Click the **Google Apps icon** (9 dots) in the top-right corner
3. Search for and click **Vids** (film-strip icon)
4. Click **Create** to start a new video project

### Step 3: Prepare Recording Materials
Before recording, create/prepare these resources:
- [ ] System architecture diagram (see Part 2 below)
- [ ] Key features list
- [ ] Test scenarios for live demo
- [ ] Conclusion slide with future improvements

---

## Part 2: Your Introduction (1 minute)

### On Camera - Introduction Script

**Timing:** 0:00 - 1:00

Read this or create your own based on this template:

> "Hello. My name is [Your Name], and I am a [Program Name] student at [University]. This is my project titled **TrackChip: A Real-Time Entity Tracking and Geofencing System**. My supervisor was [Supervisor Name].
>
> This system was developed to address the need for real-time tracking and monitoring of entities (devices, vehicles, personnel) with intelligent geofencing and alert capabilities. It demonstrates practical applications in logistics, fleet management, and location-based security monitoring.
>
> The system combines real-time positioning, intelligent geofence management, and proactive alert mechanisms to provide organizations with critical visibility and control over their assets and personnel."

### Key Points to Emphasize
- **Problem Solved:** Real-time tracking and automated geofence monitoring
- **Use Cases:** Fleet management, logistics, emergency response, asset tracking
- **Innovation:** Real-time socket-based updates, intelligent boundary detection
- **SDG Alignment:** SDG 9 (Industry, Innovation & Infrastructure), SDG 11 (Sustainable Cities)

---

## Part 3: Overall Objective (1 minute)

### Screen Share - Objective Slide

**Timing:** 1:00 - 2:00

Display this information (can be a simple text slide or screenshot):

```
TRACKCHIP SYSTEM - OVERALL OBJECTIVE

The overall objective of this project is to design and implement a 
real-time entity tracking and geofencing system that:

✓ Provides live location monitoring of multiple entities
✓ Detects and alerts on geofence boundary violations
✓ Maintains comprehensive activity audit logs
✓ Enables intelligent device/entity management
✓ Delivers real-time updates via WebSocket connections
✓ Supports role-based access control with secure authentication
```

### Script for This Section

> "The overall objective of this project is to provide organizations with a robust, real-time tracking and geofencing platform. The system enables administrators to monitor the locations of multiple entities in real-time, define geographic boundaries (geofences), and receive immediate alerts when entities enter or leave these zones. Beyond basic tracking, the system maintains detailed activity logs, provides analytical insights through charts and dashboards, and supports scalable multi-user management with role-based access controls."

---

## Part 4: Key Functionalities (1 minute)

### Screen Share - Features Overview

**Timing:** 2:00 - 3:00

Display the following (as bullet points or icons):

```
TRACKCHIP - KEY FUNCTIONALITIES

1. SECURE AUTHENTICATION & ACCESS CONTROL
   - Credential-based login with JWT tokens
   - Role-based dashboard access
   - Admin and operator user roles

2. REAL-TIME ENTITY TRACKING
   - Live location updates via WebSocket (Socket.io)
   - Interactive map view with Leaflet
   - Entity position markers and movement trails
   - Simulated location data for development/testing

3. GEOFENCE MANAGEMENT & BREACH DETECTION
   - Create/edit/delete geographic boundaries
   - Automatic breach detection
   - Real-time alerts when entities cross boundaries
   - Visual boundary display on map

4. ACTIVITY MONITORING & ANALYTICS
   - Comprehensive activity logs with timestamps
   - Entity movement history and patterns
   - Real-time charts and statistics
   - Device/entity status monitoring

5. ALERT & NOTIFICATION SYSTEM
   - Suspicious activity detection
   - Real-time alert generation
   - Alert management and acknowledgment
   - Activity history tracking
```

### Script for This Section

> "TrackChip has five core functionalities:
>
> **First, Secure Authentication & Access Control:** Users log in with credentials, receive JWT tokens, and access the system based on their role—either as an administrator or an operator.
>
> **Second, Real-Time Entity Tracking:** The system receives location updates from entities and displays them live on an interactive map with trails showing movement history.
>
> **Third, Geofence Management:** Administrators can define geographic boundaries on the map. The system automatically detects when tracked entities enter or leave these zones.
>
> **Fourth, Activity Monitoring & Analytics:** Every action is logged with timestamps. The system provides charts, statistics, and historical data for analysis.
>
> **Finally, Alert & Notification System:** The system generates real-time alerts for geofence breaches and suspicious activities, which administrators can review and acknowledge."

---

## Part 5: System Architecture (1 minute)

### Screen Share - Architecture Diagram

**Timing:** 3:00 - 4:00

Display this architecture overview:

```
┌─────────────────────────────────────────────────────────────────┐
│                      TRACKCHIP ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────┐         ┌──────────────┐   ┌──────────────┐ │
│  │              │         │              │   │              │ │
│  │ WEB CLIENT   │         │   ADMIN      │   │  OPERATORS   │ │
│  │  (React)     │         │   DASHBOARD  │   │   INTERFACE  │ │
│  │              │         │              │   │              │ │
│  └──────┬───────┘         └──────┬───────┘   └──────┬───────┘ │
│         │                        │                  │          │
│         └────────────┬───────────┴──────────────────┘          │
│                      │                                         │
│                      ▼                                         │
│         ┌────────────────────────┐                            │
│         │   FRONTEND (React)     │                            │
│         │  - Leaflet Map View    │                            │
│         │  - Real-time UI Updates│                            │
│         │  - Forms & Controls    │                            │
│         └────────┬───────────────┘                            │
│                  │                                            │
│       ┌──────────┴──────────┐                                 │
│       │ Socket.io Connection│                                 │
│       └──────────┬──────────┘                                 │
│                  │                                            │
│         ┌────────▼───────────┐                                │
│         │   BACKEND SERVER   │                                │
│         │  (Node.js/Express) │                                │
│         ├────────────────────┤                                │
│         │ • Authentication   │                                │
│         │ • Entity Tracking  │                                │
│         │ • Geofence Logic   │                                │
│         │ • WebSocket Handler│                                │
│         │ • Activity Logging │                                │
│         │ • Alert Engine     │                                │
│         └────────┬───────────┘                                │
│                  │                                            │
│         ┌────────▼───────────┐                                │
│         │  PostgreSQL + GIS  │                                │
│         │  (PostGIS)         │                                │
│         ├────────────────────┤                                │
│         │ • Users & Roles    │                                │
│         │ • Entities/Devices │                                │
│         │ • Locations        │                                │
│         │ • Geofences        │                                │
│         │ • Activity Logs    │                                │
│         │ • Alerts           │                                │
│         └────────────────────┘                                │
│                                                                │
└─────────────────────────────────────────────────────────────────┘
```

### Script for This Section

> "The TrackChip system follows a three-tier architecture:
>
> **Frontend Layer:** The React-based web client provides the user interface. It includes an interactive Leaflet map for displaying entity locations, forms for managing geofences and devices, and real-time dashboard updates. The frontend communicates with the backend through HTTP REST APIs and WebSocket connections.
>
> **Backend Layer:** The Node.js Express server handles all business logic. It processes authentication requests, manages real-time entity locations, executes geofence boundary checks, detects breaches, generates alerts, and maintains activity logs. The backend uses Socket.io to push real-time updates to connected clients.
>
> **Data Layer:** PostgreSQL with PostGIS extension stores all persistent data—users, entities, location history, geofence definitions, and audit logs. PostGIS enables powerful geographic queries for boundary detection.
>
> The flow is straightforward: when an entity's location is updated, the backend checks it against all active geofences, generates alerts if needed, logs the activity, and broadcasts the update to all connected clients in real-time."

---

## Part 6: Live Demonstration Walkthrough (4-5 minutes)

### Critical: Before You Start
- Have the application running and logged in
- Know where each feature is located
- Practice the sequence once beforehand
- Keep movements smooth and deliberate
- Narrate what you're doing as you do it

### Demo Sequence

**Timing:** 4:00 - 9:00 (5 minutes)

#### Step 1: Login & Dashboard Overview (30 seconds)
**Timing:** 4:00 - 4:30

1. Show the login page
   - Explain: "This is the secure login screen. Users authenticate with their credentials."
   - Enter credentials: `admin` / `trackchip123`
   - Click Login

2. Once logged in, show the main dashboard
   - Point out: Dashboard Cards (active entities, geofences, alerts)
   - Note: Real-time data updates via WebSocket
   - Mention: Activity logs at the bottom showing recent actions

**Script:**
> "The system starts with a secure login page. I'm logging in as an administrator using the demo credentials. Once authenticated, I'm presented with the main dashboard showing an overview of the system status—number of active tracked entities, geofences configured, and recent alerts."

---

#### Step 2: View Real-Time Entity Tracking (1 minute)
**Timing:** 4:30 - 5:30

1. Navigate to **Tracking Panel** or **Device Tracker**
   - Show the interactive Leaflet map
   - Point out entity markers on the map
   - Highlight the legend/status indicators

2. Hover over an entity marker
   - Display entity information (name, ID, last update time)
   - Show the movement trail behind the entity

3. Zoom in/out to demonstrate map interactivity

**Script:**
> "Here's the real-time tracking map. Each colored marker represents a tracked entity. The system updates their positions in real-time via WebSocket connections, so you see live movements. I can see the movement trails behind each entity, showing their historical path. Let me zoom in to show more detail on this particular entity's location."

---

#### Step 3: Demonstrate Geofence Management (1.5 minutes)
**Timing:** 5:30 - 7:00

1. Navigate to **Geofence Manager**
   - Show the list of existing geofences

2. Create a new geofence:
   - Click "Add Geofence" or similar button
   - Draw a boundary on the map (or show how to define one)
   - Enter geofence name and configuration
   - Save the geofence

3. Show the geofence on the map
   - Display the boundary as a highlighted area
   - Explain the geofence type (zone, perimeter, etc.)

4. (Optional) Demonstrate a breach scenario:
   - Show what happens when an entity enters the geofence
   - Point out the alert triggered
   - Explain: "The system detects in real-time when this entity enters the geofence and immediately generates an alert"

**Script:**
> "Now let me show the geofence management feature. I have several geofences already defined, shown here as colored zones on the map. Let me create a new one. I'll click 'Add Geofence,' name it, and then draw a boundary by clicking points on the map. Once saved, the system monitors all entities against this boundary. If any entity enters this zone, the system automatically detects the breach and generates an alert in real-time."

---

#### Step 4: Demonstrate Alerts & Notifications (1 minute)
**Timing:** 7:00 - 8:00

1. Navigate to **Alerts Manager** or **Alert Panel**
   - Show the list of recent alerts
   - Explain alert types: geofence breach, suspicious activity, device offline, etc.

2. Click on an alert to show details:
   - Entity name
   - Type of alert
   - Timestamp
   - Geographic coordinates
   - Alert status (new, acknowledged, resolved)

3. Demonstrate alert acknowledgment:
   - Click "Acknowledge" or similar
   - Show status change
   - Explain: "This helps operators track which alerts have been reviewed and acted upon"

**Script:**
> "Here are the active alerts. Each alert is generated when the system detects an anomaly—in this case, a geofence breach. I can click on any alert to see full details: which entity triggered it, the exact time and location, and its current status. I can acknowledge alerts to mark them as reviewed, which helps the team track response times and maintain accountability."

---

#### Step 5: Show Activity Logs & Analytics (1 minute)
**Timing:** 8:00 - 9:00

1. Navigate to **Activity Logs**
   - Show the chronological log of all system events
   - Point out: timestamps, entity names, action types, status

2. Show any charts/analytics if available:
   - Entity movement statistics
   - Alert frequency
   - System usage over time

3. Filter or search (if implemented):
   - Demonstrate searching by entity name or date range
   - Show real-time log updates

**Script:**
> "Every action in the system is logged with a timestamp for audit and analysis purposes. Here's the activity log showing all entity movements, geofence interactions, and system events. I can see the entity entries, geofence creations, alert triggers, and user actions. This comprehensive logging is critical for compliance and troubleshooting. The system also provides analytics through charts that show trends and patterns in entity movements and system alerts."

---

#### Step 6: Device/Entity Management (Optional, if time permits)
**Timing:** 8:30 - 9:00 (if included)

1. Navigate to **Device Manager** or **Entity Manager**
   - Show the list of tracked entities/devices
   - Display entity properties: name, ID, status, last location, type

2. Demonstrate adding a new device:
   - Click "Add Device"
   - Enter device details
   - Save

3. Show edit/delete operations:
   - Explain you can update device configurations

**Script:**
> "The Device Manager allows administrators to register and manage all entities in the system. Each device has a unique ID, type, and status. From here, I can add new devices to the system, update their information, or remove them when they're no longer tracked. The status indicator shows whether a device is actively reporting location data."

---

## Part 7: Conclusion (1 minute)

### Return to Camera

**Timing:** 9:00 - 10:00

**Script for Conclusion:**

> "That concludes my demonstration of the TrackChip System. In summary, this project delivers a comprehensive real-time tracking and geofencing platform that addresses critical needs in fleet management, logistics, and asset monitoring.
>
> **Key Contributions:**
> - Real-time entity tracking using WebSocket technology for immediate updates
> - Intelligent geofence detection with automatic breach alerts
> - Comprehensive activity logging for compliance and auditing
> - Intuitive, responsive web interface for operator and administrator access
> - Scalable architecture supporting multiple concurrent users and entities
>
> **Practical Impact:** Organizations using TrackChip can reduce response times to unauthorized location changes, improve asset utilization tracking, enhance personnel safety through real-time monitoring, and maintain complete audit trails for compliance.
>
> **Future Improvements:**
> - Integration with mobile applications for on-the-go monitoring
> - Machine learning-based anomaly detection for behavioral analysis
> - GPS and UWB integration for more accurate positioning
> - Advanced geofence shapes (polygons, circles, routes)
> - SMS and email notifications for alerts
> - Multi-site and hierarchical organization support
> - Historical data visualization and heatmap generation
>
> Thank you."

---

## Part 8: Recording & Submission Tips

### Technical Recording Tips

1. **Audio Quality**
   - Use a quiet room with minimal background noise
   - Speak clearly and at a steady pace
   - Use a microphone if possible for better audio quality

2. **Screen Recording**
   - Use Google Vids' built-in screen sharing feature
   - Record at 1080p resolution if possible
   - Close notification popups and disable system notifications
   - Disable screen saver and auto-lock during recording

3. **Pacing**
   - Record each section separately and edit them together (easier to fix mistakes)
   - Pause briefly between sections for natural transitions
   - Speak at a conversational pace—don't rush

4. **Testing**
   - Do a full practice run before the final recording
   - Test all interactive features beforehand
   - Have backup scenarios ready in case something doesn't work as expected

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Entity locations not updating | Ensure backend is running and Socket.io is connected |
| Slow map rendering | Reduce number of markers or zoom level |
| Cannot create geofence | Verify you're logged in and have admin role |
| Alerts not showing | Check that entity breaches the geofence (may need to wait for simulated movement) |
| Audio/video out of sync | Re-record the section or use Google Vids' editing tools |

### Editing in Google Vids

1. Open your recorded video
2. Use the timeline to trim sections if needed
3. Add titles/captions for each section
4. Adjust audio levels if necessary
5. Preview the full video before submitting

### Submission

1. Once recording is complete:
   - Click the **Share** button in Google Vids
   - Select "Copy link"
   - Set permission to "Commenter"

2. Submit your video link through the provided Google Form:
   - https://docs.google.com/forms/d/e/1FAIpQLSclSEeNVDbhwsFuPswOr7j7lyjYlHSLPhQE3CoGK0g-U7V-Aw/viewform?usp=publish-editor

3. Include:
   - Your name
   - Program/Year
   - Project title: TrackChip System
   - Supervisor name
   - Video link (with Commenter access)

---

## Appendix: Quick Checklist

### Before Recording
- [ ] Both server and client running
- [ ] Logged in with demo credentials
- [ ] Google Vids opened and ready
- [ ] All features tested and working
- [ ] System architecture diagram prepared
- [ ] Key functionalities list ready
- [ ] Conclusion notes prepared
- [ ] No other apps visible on screen
- [ ] Microphone tested
- [ ] Notifications disabled

### During Recording
- [ ] Introduction on camera (1 min)
- [ ] Objective slide shown (1 min)
- [ ] Features explained (1 min)
- [ ] Architecture diagram shown (1 min)
- [ ] Live demo completed (4-5 mins)
- [ ] Conclusion on camera (1 min)
- [ ] Total time ≤ 10 minutes

### After Recording
- [ ] Watch full video for quality
- [ ] Fix any audio/video issues
- [ ] Copy shareable link
- [ ] Set permission to "Commenter"
- [ ] Submit through Google Form
- [ ] Confirm submission received

---

## Notes

**Recording Date:** _______________  
**Video URL:** _______________  
**Submission Confirmation:** _______________

---

**Guide prepared based on Dr. Stanley Githinji's Project Demonstration Guidelines for APT 4900 A, SS 2026**
