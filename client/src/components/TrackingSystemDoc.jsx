import React, { useState } from 'react';

export default function TrackingSystemDoc() {
  const [expandedSection, setExpandedSection] = useState(null);

  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const Section = ({ title, id, children }) => (
    <div className="border-b border-border">
      <button
        onClick={() => toggleSection(id)}
        className="w-full text-left p-4 hover:bg-secondary transition-colors flex items-center gap-2"
      >
        <span className="text-primary">{expandedSection === id ? '▼' : '▶'}</span>
        <h3 className="text-lg font-semibold">{title}</h3>
      </button>
      {expandedSection === id && (
        <div className="p-4 bg-secondary bg-opacity-50 space-y-3">
          {children}
        </div>
      )}
    </div>
  );

  const CodeBlock = ({ code, language = 'javascript' }) => (
    <pre className="bg-background p-3 rounded border border-border text-sm overflow-auto">
      <code>{code}</code>
    </pre>
  );

  return (
    <div className="glass p-6 rounded-lg max-w-4xl mx-auto space-y-4">
      <div className="mb-6">
        <h2 className="text-3xl font-bold text-primary mb-2">🎯 TrackChip Tracking System</h2>
        <p className="text-gray-400">Complete guide on how entities are tracked and connected in real-time</p>
      </div>

      <Section id="architecture" title="📊 System Architecture">
        <p className="text-gray-300">The system uses a three-layer architecture:</p>
        <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
          <li><strong>Frontend:</strong> React components with real-time WebSocket listeners</li>
          <li><strong>Backend:</strong> Express.js server with Socket.IO for WebSocket communication</li>
          <li><strong>Database:</strong> PostgreSQL for persistent entity and device data</li>
        </ul>
      </Section>

      <Section id="device-registration" title="📱 Device Registration">
        <p className="text-gray-300 mb-3">When you register a device, here's what happens:</p>
        
        <CodeBlock code={`// Frontend: Generate unique device ID
const generateDeviceId = () => {
  const storedId = localStorage.getItem('device_id');
  if (storedId) return storedId;
  
  const newId = \`device_\${Date.now()}_\${Math.random()...}\`;
  localStorage.setItem('device_id', newId);
  return newId;
};

// Register with backend
POST /devices
Headers: Authorization: Bearer {JWT_TOKEN}
Body: {
  device_id: "device_1234567890_abc123",
  device_name: "Chrome - 01/04/2026",
  device_type: "mobile"
}`} />

        <p className="text-gray-300 mt-3"><strong>Backend Processing:</strong></p>
        <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
          <li>Authenticates JWT token from header</li>
          <li>Checks if device already registered for this user</li>
          <li>Inserts or updates device record in PostgreSQL</li>
          <li>Returns device object with registration timestamp</li>
        </ul>

        <p className="text-yellow-400 mt-3 text-sm">✅ <strong>What was fixed:</strong> Added proper error handling and device update logic. The system now checks if the device exists before insertion.</p>
      </Section>

      <Section id="entity-tracking" title="🚀 Entity Tracking & Movement">
        <p className="text-gray-300 mb-3">Entities are continuously tracked through a background loop:</p>
        
        <CodeBlock code={`// Backend: 1-second tracking interval
setInterval(async () => {
  const entities = await pool.query(
    'SELECT * FROM entities WHERE is_active = true'
  );
  
  for (const entity of entities) {
    // Generate small random movement
    const dLat = (Math.random() - 0.5) * 0.0001;
    const dLng = (Math.random() - 0.5) * 0.0001;
    
    // Update position in database
    await pool.query(
      'UPDATE entities SET lat=$1, lng=$2 WHERE id=$3',
      [entity.lat + dLat, entity.lng + dLng, entity.id]
    );
    
    // Broadcast to all connected clients
    io.emit('locationUpdate', {
      id: entity.id,
      lat: entity.lat + dLat,
      lng: entity.lng + dLng,
      timestamp: new Date().toISOString()
    });
  }
}, 1000);`} />

        <p className="text-gray-300 mt-3"><strong>Key Features:</strong></p>
        <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
          <li>Updates every 1 second (configurable)</li>
          <li>Each entity moves slightly (realistic GPS drift)</li>
          <li>Position saved to location_history table</li>
          <li>Real-time broadcast via WebSocket</li>
          <li>Geofence detection triggered on each update</li>
        </ul>
      </Section>

      <Section id="websocket-connection" title="🔌 WebSocket Real-Time Connection">
        <p className="text-gray-300 mb-3">The system uses Socket.IO for persistent, bidirectional communication:</p>

        <CodeBlock code={`// Frontend: Connect to WebSocket
const socket = io(serverUrl, {
  auth: {
    token: JWT_TOKEN
  },
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000
});

// Listen for entity updates
socket.on('locationUpdate', (update) => {
  setEntities(prev => 
    prev.map(e => e.id === update.id 
      ? { ...e, lat: update.lat, lng: update.lng } 
      : e
    )
  );
});`} />

        <p className="text-gray-300 mt-3"><strong>Real-Time Events:</strong></p>
        <ul className="list-disc list-inside space-y-2 text-gray-300 ml-4">
          <li><code className="bg-background px-2 py-1 rounded">locationUpdate</code> - Entity position changed</li>
          <li><code className="bg-background px-2 py-1 rounded">entityCreated</code> - New entity added</li>
          <li><code className="bg-background px-2 py-1 rounded">entityUpdated</code> - Entity info changed</li>
          <li><code className="bg-background px-2 py-1 rounded">entityDeleted</code> - Entity removed</li>
          <li><code className="bg-background px-2 py-1 rounded">geofenceAlert</code> - Entry/exit detected</li>
        </ul>
      </Section>

      <Section id="connection-reliability" title="🛡️ Ensuring System Connection">
        <p className="text-gray-300 mb-3"><strong>Connection Methods:</strong></p>

        <div className="bg-background p-3 rounded border border-border space-y-2">
          <p className="text-gray-300"><strong>1. WebSocket Authentication</strong></p>
          <CodeBlock code={`// Server: Validate connection
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = payload;
    next(); // Connection approved
  } catch (err) {
    next(new Error('Authentication error'));
  }
});`} />
        </div>

        <div className="bg-background p-3 rounded border border-border space-y-2 mt-3">
          <p className="text-gray-300"><strong>2. Auto-Reconnection</strong></p>
          <CodeBlock code={`// Frontend: Handle disconnections
socket.on('disconnect', () => {
  console.log('Disconnected from server');
  // Socket.IO automatically attempts reconnection
});

socket.on('reconnect', () => {
  console.log('Reconnected to server');
  // Fetch fresh entity data
  requestEntities();
});`} />
        </div>

        <div className="bg-background p-3 rounded border border-border space-y-2 mt-3">
          <p className="text-gray-300"><strong>3. Heartbeat Mechanism</strong></p>
          <p className="text-gray-300">Socket.IO maintains a ping/pong heartbeat every 25 seconds to detect stale connections.</p>
        </div>

        <div className="bg-background p-3 rounded border border-border space-y-2 mt-3">
          <p className="text-gray-300"><strong>4. Database Persistence</strong></p>
          <p className="text-gray-300">All entity positions, devices, and events are stored in PostgreSQL for historical tracking and recovery if connections drop.</p>
        </div>
      </Section>

      <Section id="data-flow" title="📡 Complete Data Flow">
        <p className="text-gray-300 mb-3">How a new entity registration flows through the system:</p>
        
        <div className="space-y-3">
          <div className="flex gap-3 items-start">
            <span className="text-primary font-bold">1.</span>
            <div>
              <p className="font-semibold text-gray-200">User adds new entity in frontend</p>
              <p className="text-sm text-gray-400">Name: "Device", Type: "mobile", Location: Current</p>
            </div>
          </div>
          
          <div className="flex gap-3 items-start">
            <span className="text-primary font-bold">2.</span>
            <div>
              <p className="font-semibold text-gray-200">POST /entities request sent with JWT auth</p>
              <p className="text-sm text-gray-400">Backend validates token and user ownership</p>
            </div>
          </div>
          
          <div className="flex gap-3 items-start">
            <span className="text-primary font-bold">3.</span>
            <div>
              <p className="font-semibold text-gray-200">Entity inserted into PostgreSQL</p>
              <p className="text-sm text-gray-400">Unique ID, owner_id, and device_id stored</p>
            </div>
          </div>
          
          <div className="flex gap-3 items-start">
            <span className="text-primary font-bold">4.</span>
            <div>
              <p className="font-semibold text-gray-200">entityCreated event broadcast via WebSocket</p>
              <p className="text-sm text-gray-400">All connected clients receive the new entity</p>
            </div>
          </div>
          
          <div className="flex gap-3 items-start">
            <span className="text-primary font-bold">5.</span>
            <div>
              <p className="font-semibold text-gray-200">1-second tracking loop picks it up</p>
              <p className="text-sm text-gray-400">Entity begins moving and location broadcasts</p>
            </div>
          </div>

          <div className="flex gap-3 items-start">
            <span className="text-primary font-bold">6.</span>
            <div>
              <p className="font-semibold text-gray-200">Frontend updates map in real-time</p>
              <p className="text-sm text-gray-400">Smooth animation shows entity movement</p>
            </div>
          </div>
        </div>
      </Section>

      <Section id="troubleshooting" title="🔧 Troubleshooting Guide">
        <div className="space-y-4">
          <div className="bg-red-900 bg-opacity-20 border border-red-700 p-3 rounded">
            <p className="font-semibold text-red-300">❌ "Failed to register device"</p>
            <ul className="list-disc list-inside text-sm text-gray-300 ml-4 mt-2">
              <li>Check browser console for network errors</li>
              <li>Verify JWT token is valid (check login)</li>
              <li>Ensure backend server is running on port 4000</li>
              <li>Check CORS is enabled on server</li>
            </ul>
          </div>

          <div className="bg-red-900 bg-opacity-20 border border-red-700 p-3 rounded">
            <p className="font-semibold text-red-300">❌ Entities not moving</p>
            <ul className="list-disc list-inside text-sm text-gray-300 ml-4 mt-2">
              <li>Check WebSocket connection (DevTools → Network → WS)</li>
              <li>Verify entities are in database: `SELECT * FROM entities;`</li>
              <li>Ensure backend tracking loop is running</li>
            </ul>
          </div>

          <div className="bg-red-900 bg-opacity-20 border border-red-700 p-3 rounded">
            <p className="font-semibold text-red-300">❌ Map not updating</p>
            <ul className="list-disc list-inside text-sm text-gray-300 ml-4 mt-2">
              <li>Check browser console for React errors</li>
              <li>Verify WebSocket is connected and receiving updates</li>
              <li>Check network tab for locationUpdate messages</li>
            </ul>
          </div>
        </div>
      </Section>

      <Section id="database-schema" title="💾 Database Schema">
        <p className="text-gray-300 mb-3"><strong>Key Tables:</strong></p>
        
        <CodeBlock code={`-- Devices registered for tracking
CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  device_id TEXT UNIQUE,
  user_id INTEGER REFERENCES users(id),
  device_name TEXT,
  device_type TEXT DEFAULT 'phone',
  is_active BOOLEAN DEFAULT TRUE,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Entities being tracked
CREATE TABLE entities (
  id SERIAL PRIMARY KEY,
  entity_id TEXT UNIQUE,
  type TEXT, -- 'person', 'vehicle', 'asset', 'device'
  label TEXT,
  owner_id INTEGER REFERENCES users(id),
  device_id TEXT, -- Link to registered device
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Position history for analytics
CREATE TABLE location_history (
  id SERIAL PRIMARY KEY,
  entity_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  source TEXT -- 'real-time', 'gps', 'api'
);

-- Track events (geofence, user actions)
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  entity_id TEXT,
  event TEXT, -- 'geofence_enter', 'geofence_exit'
  label TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);`} />
      </Section>

      <div className="bg-primary bg-opacity-10 border border-primary p-4 rounded mt-6">
        <p className="text-sm text-gray-300">
          <strong>💡 Summary:</strong> The TrackChip system ensures reliable entity tracking through authenticated WebSocket connections, 
          real-time database updates, and automatic reconnection. Devices register once and can track multiple entities 
          simultaneously with persistent data storage.
        </p>
      </div>
    </div>
  );
}
