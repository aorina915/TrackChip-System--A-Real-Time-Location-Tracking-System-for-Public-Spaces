require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const http = require('http');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { Server } = require('socket.io');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const MicrosoftStrategy = require('passport-microsoft').Strategy;
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');

// ---------------------------------------------------------------------------
// UTILITY FUNCTIONS
// ---------------------------------------------------------------------------
function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0000001) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

// Initialize Stripe with environment variable
const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_your_stripe_secret_key_here';
const stripe = require('stripe')(stripeKey);

// Log Stripe configuration status
if (stripeKey === 'sk_test_your_stripe_secret_key_here') {
  console.warn('⚠️  WARNING: Using default Stripe key. Set STRIPE_SECRET_KEY environment variable for production.');
} else {
  console.log('✅ Stripe configured successfully');
  console.log('Stripe key loaded:', stripeKey.substring(0, 20) + '...');
}

const app = express();
app.use(cors());
app.use(express.json());

let io = null;
let dbConnected = false;

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'changeme123';

// ---------------------------------------------------------------------------
// DB
// ---------------------------------------------------------------------------
console.log('DB Config:', {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD ? '[HIDDEN]' : 'NOT SET',
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL
});

const pool = new Pool({
  user: process.env.DB_USER,
  password: String(process.env.DB_PASSWORD),
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
});

// ---------------------------------------------------------------------------
// DB TABLE CREATION
// ---------------------------------------------------------------------------
const createTables = async () => {
  try {
    // Users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        email TEXT UNIQUE,
        role TEXT NOT NULL DEFAULT 'client',
        organization TEXT,
        reset_token TEXT,
        reset_token_expiry TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS organization TEXT`);

    // Geofences table - drop and recreate if needed
    try {
      await pool.query('DROP TABLE IF EXISTS geofences CASCADE');
    } catch (err) {
      console.log('Geofences table drop skipped:', err.message);
    }
    
    await pool.query(`
      CREATE TABLE geofences (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        coordinates JSONB NOT NULL,
        type TEXT DEFAULT 'social',
        user_id INTEGER,
        duration_hours INTEGER,
        expiry_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Location history table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS location_history (
        id SERIAL PRIMARY KEY,
        entity_id TEXT NOT NULL,
        timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        lat DOUBLE PRECISION NOT NULL,
        lng DOUBLE PRECISION NOT NULL,
        source TEXT NOT NULL
      )
    `);

    // Entities table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS entities (
        id SERIAL PRIMARY KEY,
        entity_id TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL,
        label TEXT NOT NULL,
        owner_id INTEGER NOT NULL,
        device_id TEXT,
        lat DOUBLE PRECISION NOT NULL DEFAULT 0,
        lng DOUBLE PRECISION NOT NULL DEFAULT 0,
        status TEXT DEFAULT 'active',
        last_alert TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (owner_id) REFERENCES users(id)
      )
    `);

    // Devices table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id SERIAL PRIMARY KEY,
        device_id TEXT UNIQUE NOT NULL,
        user_id INTEGER NOT NULL,
        device_name TEXT NOT NULL,
        device_type TEXT DEFAULT 'phone',
        is_active BOOLEAN DEFAULT TRUE,
        last_seen TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Events table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        entity_id TEXT,
        event TEXT NOT NULL,
        label TEXT,
        status TEXT DEFAULT 'pending',
        attended_at TIMESTAMPTZ,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Alerts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        entity_id TEXT,
        issue_type TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Audit logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id TEXT,
        details JSONB,
        ip_address INET,
        user_agent TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Subscriptions table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER UNIQUE NOT NULL,
        plan TEXT DEFAULT 'free',
        entity_limit INTEGER DEFAULT 4,
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Insert sample geofence if it doesn't exist
    await pool.query(`
      INSERT INTO geofences(name, coordinates) 
      SELECT 'Campus Core', '[[36.8165, -1.2870], [36.8195, -1.2870], [36.8195, -1.2850], [36.8165, -1.2850], [36.8165, -1.2870]]'::jsonb
      WHERE NOT EXISTS (SELECT 1 FROM geofences WHERE name = 'Campus Core')
    `);

    // Create performance indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_entities_owner_id ON entities(owner_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_entities_entity_id ON entities(entity_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_alerts_entity_id ON alerts(entity_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_alerts_user_id ON alerts(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_alerts_status ON alerts(status)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(created_at DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_location_history_entity_id ON location_history(entity_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_location_history_timestamp ON location_history(timestamp DESC)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_geofences_user_id ON geofences(user_id)`);

    // Create default demo entities if none exist
    await createDefaultEntities();

    console.log('✅ Database tables verified/created');
  } catch (err) {
    console.error('❌ Table creation error:', err);
  }
};

// ---------------------------------------------------------------------------
// HELPER: Create default demo entities
// ---------------------------------------------------------------------------
const createDefaultEntities = async () => {
  try {
    // Check if any entities exist
    const result = await pool.query('SELECT COUNT(*) as count FROM entities');
    if (parseInt(result.rows[0].count) > 0) return; // Already have entities

    const defaultEntities = [
      { entity_id: 'demo_student_1', type: 'person', label: 'Student A', lat: -1.286389, lng: 36.817223 },
      { entity_id: 'demo_bus_1', type: 'vehicle', label: 'Campus Shuttle', lat: -1.286389 + 0.0005, lng: 36.817223 + 0.0005 },
      { entity_id: 'demo_guard_1', type: 'person', label: 'Security Guard', lat: -1.286389 - 0.0003, lng: 36.817223 - 0.0003 },
      { entity_id: 'demo_delivery_1', type: 'asset', label: 'Package Delivery', lat: -1.286389 + 0.0002, lng: 36.817223 - 0.0002 }
    ];

    // Create a demo user if needed
    let demoUserId = 1;
    try {
      const userResult = await pool.query('SELECT id FROM users WHERE username = $1', ['demo']);
      if (userResult.rows.length === 0) {
        // NOTE: Demo user must be created with a strong hashed password in production
      // For development, use: npm run seed-demo or manually create via /auth/register
      // NEVER commit plaintext passwords to version control
      const demoHash = await bcrypt.hash(process.env.DEMO_PASSWORD || 'demo_change_me_123', 10);
      const newUser = await pool.query(
          'INSERT INTO users (username, password_hash, role) VALUES ($1, $2, $3) RETURNING id',
          ['demo', demoHash, 'client']
        );
        demoUserId = newUser.rows[0].id;
      } else {
        demoUserId = userResult.rows[0].id;
      }
    } catch (err) {
      console.log('Demo user creation skipped:', err.message);
    }

    for (const entity of defaultEntities) {
      try {
        await pool.query(
          `INSERT INTO entities (entity_id, type, label, owner_id, lat, lng, updated_at) 
           VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
          [entity.entity_id, entity.type, entity.label, demoUserId, entity.lat, entity.lng]
        );
      } catch (err) {
        console.log(`Entity ${entity.label} creation skipped:`, err.message);
      }
    }

    console.log('✅ Default demo entities created');
  } catch (err) {
    console.error('❌ Default entities creation error:', err);
  }
};

// ---------------------------------------------------------------------------
// HELPER: Check entity creation limits
// ---------------------------------------------------------------------------
const canCreateEntity = async (userId) => {
  if (!dbConnected) return true; // Allow in memory mode

  try {
    // Get user's subscription
    const subResult = await pool.query(
      'SELECT plan, entity_limit FROM subscriptions WHERE user_id = $1 AND active = true',
      [userId]
    );

    const subscription = subResult.rows[0] || { plan: 'free', entity_limit: 4 };

    // Count current entities
    const entityResult = await pool.query(
      'SELECT COUNT(*) as count FROM entities WHERE owner_id = $1',
      [userId]
    );

    const currentCount = parseInt(entityResult.rows[0].count);
    return currentCount < subscription.entity_limit;
  } catch (err) {
    console.error('Subscription check error:', err);
    return false;
  }
};

const getEntityLimit = async (userId) => {
  if (!dbConnected) return 4;

  try {
    const subResult = await pool.query(
      'SELECT entity_limit FROM subscriptions WHERE user_id = $1 AND active = true',
      [userId]
    );

    return subResult.rows[0]?.entity_limit || 4;
  } catch (err) {
    console.error('Entity limit check error:', err);
    return 4;
  }
};

// ---------------------------------------------------------------------------
// AUDIT LOGGING
// ---------------------------------------------------------------------------
const logAuditEvent = async (userId, action, resourceType, resourceId = null, details = {}, req = null) => {
  if (!dbConnected) return;

  try {
    const auditData = {
      user_id: userId,
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      details,
      ip_address: req ? req.ip : null,
      user_agent: req ? req.get('User-Agent') : null
    };

    await pool.query(`
      INSERT INTO audit_logs (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      auditData.user_id,
      auditData.action,
      auditData.resource_type,
      auditData.resource_id,
      JSON.stringify(auditData.details),
      auditData.ip_address,
      auditData.user_agent
    ]);
  } catch (err) {
    console.error('Audit logging error:', err);
  }
};

// ---------------------------------------------------------------------------
// ENTITY MOVEMENT SIMULATION
// ---------------------------------------------------------------------------
const startEntityMovement = () => {
  if (!dbConnected) return;

  // Move entities every 3 seconds
  setInterval(async () => {
    try {
      const entities = await pool.query(
        `SELECT e.*, u.organization 
         FROM entities e 
         LEFT JOIN users u ON e.owner_id = u.id 
         WHERE e.is_active = true`
      );
      
      for (const entity of entities.rows) {
        // Small random movement
        const dLat = (Math.random() - 0.5) * 0.0001;
        const dLng = (Math.random() - 0.5) * 0.0001;
        
        const newLat = entity.lat + dLat;
        const newLng = entity.lng + dLng;
        
        // Update position
        await pool.query(
          'UPDATE entities SET lat = $1, lng = $2, updated_at = NOW() WHERE id = $3',
          [newLat, newLng, entity.id]
        );
        
        // Store in location history
        await pool.query(
          'INSERT INTO location_history (entity_id, lat, lng, source) VALUES ($1, $2, $3, $4)',
          [entity.entity_id, newLat, newLng, 'simulation']
        );
        
        const room = getOrgRoom({ organization: entity.organization });
        io.to(room).emit('locationUpdate', {
          id: entity.id,
          lat: newLat,
          lng: newLng,
          timestamp: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error('Entity movement error:', err);
    }
  }, 3000); // Every 3 seconds
};

// ---------------------------------------------------------------------------
// In-memory fallback (DEPRECATED - Use database users only)
// ---------------------------------------------------------------------------
// NOTE: In-memory users are for development only. Do NOT use in production.
// All users must be managed through the database with bcrypt-hashed passwords.
const users = [
  // REMOVED: Hardcoded credentials were a security risk. Use .env and database instead.
];

// ---------------------------------------------------------------------------
// MIDDLEWARE: Verify JWT
// ---------------------------------------------------------------------------
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    console.warn('❌ No token provided in request to', req.path);
    return res.status(401).json({ message: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.warn('❌ Token verification failed for', req.path, ':', err.message);
      return res.status(403).json({ message: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// ---------------------------------------------------------------------------
// PASSPORT CONFIGURATION
// ---------------------------------------------------------------------------
app.use(passport.initialize());

// Check if Google OAuth is configured
const googleConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;
const microsoftConfigured = process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET;

if (googleConfigured) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/auth/google/callback'
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      // Check if user exists, if not create one
      let user;
      if (dbConnected) {
        const result = await pool.query(
          'SELECT * FROM users WHERE email=$1',
          [profile.emails?.[0]?.value]
        );
        
        if (result.rows.length > 0) {
          user = result.rows[0];
        } else {
          // Create new user from Google profile
          const newUser = await pool.query(
            `INSERT INTO users (username, email, password_hash, role, organization)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, username, email, role, organization`,
            [profile.displayName || profile.emails?.[0]?.value.split('@')[0], 
             profile.emails?.[0]?.value,
             'oauth_google', // Special marker for OAuth users
             'client',
             profile.displayName || 'Google User']
          );
          user = newUser.rows[0];
        }
      }
      
      return done(null, {
        id: user.id,
        sub: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        organization: user.organization,
        provider: 'google'
      });
    } catch (err) {
      console.error('Google OAuth error:', err);
      return done(err);
    }
  }));
  console.log('✅ Google OAuth configured');
} else {
  console.warn('⚠️  Google OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env');
}

if (microsoftConfigured) {
  passport.use(new MicrosoftStrategy({
    clientID: process.env.MICROSOFT_CLIENT_ID,
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
    callbackURL: process.env.MICROSOFT_CALLBACK_URL || 'http://localhost:4000/auth/microsoft/callback'
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      let user;
      if (dbConnected) {
        const result = await pool.query(
          'SELECT * FROM users WHERE email=$1',
          [profile.emails?.[0]?.value]
        );
        
        if (result.rows.length > 0) {
          user = result.rows[0];
        } else {
          const newUser = await pool.query(
            `INSERT INTO users (username, email, password_hash, role, organization)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, username, email, role, organization`,
            [profile.displayName || profile.emails?.[0]?.value.split('@')[0],
             profile.emails?.[0]?.value,
             'oauth_microsoft',
             'client',
             profile.displayName || 'Microsoft User']
          );
          user = newUser.rows[0];
        }
      }
      
      return done(null, {
        id: user.id,
        sub: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        organization: user.organization,
        provider: 'microsoft'
      });
    } catch (err) {
      console.error('Microsoft OAuth error:', err);
      return done(err);
    }
  }));
  console.log('✅ Microsoft OAuth configured');
} else {
  console.warn('⚠️  Microsoft OAuth not configured. Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in .env');
}

// ---------------------------------------------------------------------------
// AUTH LOGIN
// ---------------------------------------------------------------------------
app.post('/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password)
    return res.status(400).json({ message: 'Username and password are required' });

  console.log(`Login attempt: "${username}" | dbConnected=${dbConnected}`);

  try {
    if (dbConnected) {
      const result = await pool.query(
        `SELECT id, username, role, organization, password_hash FROM users WHERE username=$1`,
        [username]
      );

      // 🔁 FALLBACK to memory
      if (result.rows.length === 0) {
        console.log("User not found in DB → checking memory fallback");
        const memUser = users.find(u => u.username === username && u.password === password);
        if (!memUser) return res.status(401).json({ message: "Invalid credentials" });

        const token = jwt.sign({ sub: memUser.id, username: memUser.username, role: memUser.role }, JWT_SECRET, { expiresIn: "8h" });
        return res.json({ token, username: memUser.username, role: memUser.role });
      }

      const user = result.rows[0];

      // OAuth-only account check
      if (!user.password_hash || user.password_hash.length === 0) {
        return res.status(401).json({ message: "This account uses Google/Microsoft login. Use OAuth instead." });
      }

      let passwordValid = false;

      // bcrypt
      if (user.password_hash.startsWith("$2")) {
        passwordValid = await bcrypt.compare(password, user.password_hash);
      }
      // plaintext fallback + upgrade
      else {
        passwordValid = password === user.password_hash;
        if (passwordValid) {
          const newHash = await bcrypt.hash(password, 10);
          await pool.query(`UPDATE users SET password_hash=$1 WHERE id=$2`, [newHash, user.id]);
          console.log(`Upgraded password hash for ${username}`);
        }
      }

      if (!passwordValid) return res.status(401).json({ message: "Invalid credentials" });

      const token = jwt.sign({ sub: user.id, username: user.username, role: user.role, organization: user.organization }, JWT_SECRET, { expiresIn: "168h" });
      
      // Log successful login
      await logAuditEvent(user.id, 'LOGIN', 'auth', null, { method: 'password' }, req);
      
      return res.json({ token, username: user.username, role: user.role, organization: user.organization });

    } else {
      // MEMORY MODE
      const user = users.find(u => u.username === username && u.password === password);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });

      const token = jwt.sign({ sub: user.id, username: user.username, role: user.role, organization: user.organization }, JWT_SECRET, { expiresIn: "168h" });
      return res.json({ token, username: user.username, role: user.role, organization: user.organization });
    }
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Login error" });
  }
});

// ---------------------------------------------------------------------------
// REFRESH TOKEN
// ---------------------------------------------------------------------------
app.post('/auth/refresh', authenticateToken, async (req, res) => {
  // Since JWT is stateless, we can just return the same user info with a new token
  // In a production app, you'd use refresh tokens stored in DB
  const token = jwt.sign({ 
    sub: req.user.sub, 
    username: req.user.username, 
    role: req.user.role, 
    organization: req.user.organization 
  }, JWT_SECRET, { expiresIn: "168h" });
  
  res.json({ token });
});

// ---------------------------------------------------------------------------
// REGISTER
// ---------------------------------------------------------------------------
app.post('/auth/register', async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database required for registration' });

  const { username, password, email, role, organization } = req.body;

  try {
    const existing = await pool.query('SELECT id FROM users WHERE username=$1', [username]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users (username, email, password_hash, role, organization) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id, username, role, organization`,
      [username, email, passwordHash, role || 'client', organization]
    );

    const user = result.rows[0];
    const token = jwt.sign({ sub: user.id, username: user.username, role: user.role, organization: user.organization }, JWT_SECRET, { expiresIn: "8h" });

    console.log(`New user registered: ${username} (${role || 'client'}) - org: ${organization}`);
    res.json({ token, username: user.username, role: user.role, organization: user.organization });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Registration failed' });
  }
});

// ---------------------------------------------------------------------------
// EVENTS
// ---------------------------------------------------------------------------
app.get('/events', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.json([]);

  try {
    const events = await getEventsForUser(req.user);
    res.json(events);
  } catch (err) {
    console.error('Events fetch error:', err);
    res.json([]);
  }
});

app.post('/events', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.status(200).json({ success: true });

  try {
    const { entityId, label, event, timestamp } = req.body;
    await pool.query(
      `INSERT INTO events (entity_id, label, event, timestamp) 
       VALUES ($1, $2, $3, $4)`,
      [entityId, label, event, timestamp]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Event save error:', err);
    res.status(500).json({ error: 'Failed to save event' });
  }
});

// ---------------------------------------------------------------------------
// ACTIVITY LOGS
// ---------------------------------------------------------------------------
app.get('/activity-logs', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.json([]);

  try {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    // For admin users, show all activity logs; for others, show only their own
    const query = req.user.role === 'admin'
      ? `SELECT al.*, u.username 
         FROM audit_logs al 
         LEFT JOIN users u ON al.user_id = u.id 
         ORDER BY al.created_at DESC 
         LIMIT $1 OFFSET $2`
      : `SELECT al.*, u.username 
         FROM audit_logs al 
         LEFT JOIN users u ON al.user_id = u.id 
         WHERE al.user_id = $1 
         ORDER BY al.created_at DESC 
         LIMIT $2 OFFSET $3`;

    const params = req.user.role === 'admin'
      ? [limit, offset]
      : [req.user.sub, limit, offset];

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Activity logs fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch activity logs' });
  }
});

// ---------------------------------------------------------------------------
// ENTITIES (CRUD)
// ---------------------------------------------------------------------------
app.get('/entities', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.json([]);

  try {
    const entities = await getEntitiesForUser(req.user);
    res.json(entities);
  } catch (err) {
    console.error('Entities fetch error:', err);
    res.json([]);
  }
});

app.post('/entities', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database required' });

  try {
    // Check entity creation limits
    const canCreate = await canCreateEntity(req.user.sub);
    if (!canCreate) {
      const limit = await getEntityLimit(req.user.sub);
      return res.status(403).json({ 
        error: `Entity limit reached (${limit}). Upgrade to premium for unlimited entities.`,
        upgradeRequired: true
      });
    }

    const { label, lat, lng, entity_type, device_id } = req.body;
    const entityId = `entity_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await pool.query(
      `INSERT INTO entities (entity_id, type, label, owner_id, device_id, lat, lng, updated_at) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) RETURNING *`,
      [entityId, entity_type || 'vehicle', label, req.user.sub, device_id || null, lat, lng]
    );
    const entity = result.rows[0];

    const room = getOrgRoom(req.user);
    io.to(room).emit('entityCreated', entity);
    console.log(`Entity created: ${label} (${entity.id})`);
    
    // Log entity creation
    await logAuditEvent(req.user.sub, 'CREATE', 'entity', entity.id, { 
      label, 
      type: entity_type || 'vehicle',
      device_id 
    }, req);
    
    res.json(entity);
  } catch (err) {
    console.error('Entity create error:', err);
    res.status(500).json({ error: 'Failed to create entity' });
  }
});

app.put('/entities/:id', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database required' });

  try {
    const { id } = req.params;
    const { label, lat, lng, entity_type } = req.body;

    const ownerCheck = await pool.query('SELECT owner_id FROM entities WHERE id=$1', [id]);
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Entity not found' });
    }
    if (req.user.role !== 'admin' && ownerCheck.rows[0].owner_id !== req.user.sub) {
      return res.status(403).json({ message: 'Unauthorized to update this entity' });
    }
    
    const result = await pool.query(
      `UPDATE entities SET label=$1, lat=$2, lng=$3, entity_type=$4, updated_at=NOW() 
       WHERE id=$5 RETURNING *`,
      [label, lat, lng, entity_type, id]
    );

    const entity = result.rows[0];
    const room = getOrgRoom(req.user);
    io.to(room).emit('entityUpdated', entity);
    res.json(entity);
  } catch (err) {
    console.error('Entity update error:', err);
    res.status(500).json({ error: 'Failed to update entity' });
  }
});

app.delete('/entities/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    if (dbConnected) {
      const ownerCheck = await pool.query('SELECT owner_id FROM entities WHERE id=$1', [id]);
      if (ownerCheck.rows.length === 0) {
        return res.status(404).json({ message: 'Entity not found' });
      }
      if (req.user.role !== 'admin' && ownerCheck.rows[0].owner_id !== req.user.sub) {
        return res.status(403).json({ message: 'Unauthorized to delete this entity' });
      }

      const result = await pool.query('DELETE FROM entities WHERE id=$1 RETURNING id', [id]);
      if (result.rows.length > 0) {
        const room = getOrgRoom(req.user);
        io.to(room).emit('entityDeleted', id);
      }
    } else {
      const room = getOrgRoom(req.user);
      io.to(room).emit('entityDeleted', id);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Entity delete error:', err);
    res.status(500).json({ error: 'Failed to delete entity' });
  }
});

// ---------------------------------------------------------------------------
// GEOFENCES (CRUD)
// ---------------------------------------------------------------------------
app.get('/geofences', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.json([]);

  try {
    const geofences = await getGeofencesForUser(req.user);
    res.json(geofences);
  } catch (err) {
    console.error('Geofences fetch error:', err);
    res.json([]);
  }
});

app.post('/geofences', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database required' });

  try {
    const { name, coordinates, type, durationHours } = req.body;
    
    // Calculate expiry date if duration is provided
    let expiryDate = null;
    if (durationHours && durationHours > 0) {
      const now = new Date();
      expiryDate = new Date(now.getTime() + durationHours * 60 * 60 * 1000);
    }
    
    const result = await pool.query(
      `INSERT INTO geofences (name, coordinates, type, user_id, duration_hours, expiry_date, created_at) 
       VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
      [name, JSON.stringify(coordinates), type || 'social', req.user.sub, durationHours || null, expiryDate]
    );

    const geofence = result.rows[0];
    // coordinates is already JSONB, no need to parse
    const room = getOrgRoom(req.user);
    io.to(room).emit('geofences', await getGeofencesForUser(req.user));
    console.log(`Geofence created: ${name}${expiryDate ? ` (expires: ${expiryDate.toISOString()})` : ''}`);
    
    await logAuditEvent(req.user.sub, 'CREATE', 'geofence', geofence.id, { 
      name: geofence.name, 
      type: geofence.type,
      durationHours: durationHours || null
    }, req);
    
    res.json(geofence);
  } catch (err) {
    console.error('Geofence create error:', err);
    res.status(500).json({ error: 'Failed to create geofence' });
  }
});

app.delete('/geofences/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    if (dbConnected) {
      // Get geofence info before deleting for audit log
      const geofenceResult = await pool.query('SELECT name FROM geofences WHERE id=$1', [id]);
      const geofenceName = geofenceResult.rows[0]?.name || 'Unknown';
      
      await pool.query('DELETE FROM geofences WHERE id=$1', [id]);
      
      // Log the deletion
      await logAuditEvent(req.user.sub, 'DELETE', 'geofence', id, { 
        name: geofenceName
      }, req);
    }
    const room = getOrgRoom(req.user);
    io.to(room).emit('geofences', await getGeofencesForUser(req.user));
    res.json({ success: true });
  } catch (err) {
    console.error('Geofence delete error:', err);
    res.status(500).json({ error: 'Failed to delete geofence' });
  }
});

// ---------------------------------------------------------------------------
// HELPER: Get all geofences
// ---------------------------------------------------------------------------
const getAllGeofences = async () => {
  if (!dbConnected) return [];
  try {
    const result = await pool.query('SELECT * FROM geofences');
    return result.rows.map(row => ({
      ...row,
      coordinates: row.coordinates // Already JSONB, no need to parse
    }));
  } catch {
    return [];
  }
};

// ---------------------------------------------------------------------------
// ALERTS (CRUD)
// ---------------------------------------------------------------------------
app.get('/alerts', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.json([]);

  try {
    const alerts = await getAlertsForUser(req.user);
    res.json(alerts);
  } catch (err) {
    console.error('Alerts fetch error:', err);
    res.json([]);
  }
});

app.post('/entities/:id/report', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database required' });

  try {
    const { id } = req.params;
    const { issue_type, description } = req.body;

    const entityCheck = await pool.query(
      `SELECT e.id FROM entities e
       JOIN users u ON e.owner_id = u.id
       WHERE e.id = $1 AND (
         u.organization = $2 OR (u.organization IS NULL AND $2 IS NULL) OR $3 = 'admin'
       )`,
      [id, req.user.organization, req.user.role]
    );
    if (entityCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Unauthorized to report this entity' });
    }

    // Create alert
    const result = await pool.query(
      `INSERT INTO alerts (user_id, entity_id, issue_type, description, created_at) 
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
      [req.user.sub, id, issue_type, description]
    );

    const alert = result.rows[0];

    // Also create an event for real-time notifications
    await pool.query(
      `INSERT INTO events (user_id, entity_id, event, label, timestamp) 
       VALUES ($1, $2, $3, $4, NOW())`,
      [req.user.sub, id, issue_type, description]
    );

    // Log audit event for issue report
    await logAuditEvent(req.user.sub, 'REPORT', 'alert', alert.id, { 
      entityId: id,
      issueType: issue_type,
      description: description
    }, req);

    // Broadcast alert to same organization
    const room = getOrgRoom(req.user);
    io.to(room).emit('entityAlert', {
      entityId: id,
      issue_type,
      description,
      timestamp: new Date().toISOString()
    });

    res.json(alert);
  } catch (err) {
    console.error('Alert report error:', err);
    res.status(500).json({ error: 'Failed to report alert' });
  }
});

app.put('/alerts/:id/status', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database required' });

  try {
    const { id } = req.params;
    const { status } = req.body;
    
    const updateFields = ['status = $1'];
    const values = [status];
    
    if (status === 'resolved') {
      updateFields.push('resolved_at = NOW()');
    }
    
    await pool.query(
      `UPDATE alerts SET ${updateFields.join(', ')} WHERE id = $2`,
      [...values, id]
    );

    // Log audit event for status change
    await logAuditEvent(req.user.sub, 'UPDATE', 'alert', id, { 
      status: status,
      action: 'status_change'
    }, req);

    res.json({ success: true });
  } catch (err) {
    console.error('Alert status update error:', err);
    res.status(500).json({ error: 'Failed to update alert status' });
  }
});

// ---------------------------------------------------------------------------
// DEMO ENTITIES
// ---------------------------------------------------------------------------
app.post('/demo/entities', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database required' });

  try {
    const demoEntities = [
      { label: 'Demo Student A', type: 'person', lat: -1.286389 + (Math.random() - 0.5) * 0.001, lng: 36.817223 + (Math.random() - 0.5) * 0.001 },
      { label: 'Demo Shuttle Bus', type: 'vehicle', lat: -1.286389 + (Math.random() - 0.5) * 0.001, lng: 36.817223 + (Math.random() - 0.5) * 0.001 },
      { label: 'Demo Package #123', type: 'asset', lat: -1.286389 + (Math.random() - 0.5) * 0.001, lng: 36.817223 + (Math.random() - 0.5) * 0.001 },
      { label: 'Demo Security Guard', type: 'person', lat: -1.286389 + (Math.random() - 0.5) * 0.001, lng: 36.817223 + (Math.random() - 0.5) * 0.001 },
      { label: 'Demo Delivery Van', type: 'vehicle', lat: -1.286389 + (Math.random() - 0.5) * 0.001, lng: 36.817223 + (Math.random() - 0.5) * 0.001 }
    ];

    const createdEntities = [];

    for (const entity of demoEntities) {
      const entityId = `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const result = await pool.query(
        `INSERT INTO entities (entity_id, type, label, owner_id, lat, lng, updated_at) 
         VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING *`,
        [entityId, entity.type, entity.label, req.user.sub, entity.lat, entity.lng]
      );
      const created = result.rows[0];
      createdEntities.push(created);

      // Broadcast each entity creation to the user's organization
      const room = getOrgRoom(req.user);
      io.to(room).emit('entityCreated', created);
    }

    console.log(`Demo entities created: ${createdEntities.length}`);
    res.json({ success: true, entities: createdEntities });
  } catch (err) {
    console.error('Demo entities creation error:', err);
    res.status(500).json({ error: 'Failed to create demo entities' });
  }
});

// ---------------------------------------------------------------------------
// LOCATION HISTORY (for heatmaps)
// ---------------------------------------------------------------------------
app.get('/location-history', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.json([]);

  try {
    const limit = parseInt(req.query.limit) || 1000;
    const hours = parseInt(req.query.hours) || 24;
    const rows = await getLocationHistoryForUser(req.user, hours, limit);
    res.json(rows);
  } catch (err) {
    console.error('Location history fetch error:', err);
    res.json([]);
  }
});

// ---------------------------------------------------------------------------
// SUBSCRIPTIONS
// ---------------------------------------------------------------------------
app.get('/subscription', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.json({ plan: 'free', entity_limit: 4, current_count: 0 });

  try {
    // Get subscription
    const subResult = await pool.query(
      'SELECT plan, entity_limit FROM subscriptions WHERE user_id = $1 AND active = true',
      [req.user.sub]
    );

    const subscription = subResult.rows[0] || { plan: 'free', entity_limit: 4 };

    // Count current entities
    const entityResult = await pool.query(
      'SELECT COUNT(*) as count FROM entities WHERE owner_id = $1',
      [req.user.sub]
    );

    const currentCount = parseInt(entityResult.rows[0].count);

    res.json({
      ...subscription,
      current_count: currentCount
    });
  } catch (err) {
    console.error('Subscription fetch error:', err);
    res.json({ plan: 'free', entity_limit: 4, current_count: 0 });
  }
});

app.post('/subscription/upgrade', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database required' });

  try {
    const { plan } = req.body;
    const entityLimit = plan === 'premium' ? 999999 : 4; // Unlimited for premium

    // Upsert subscription
    await pool.query(`
      INSERT INTO subscriptions (user_id, plan, entity_limit, active, updated_at)
      VALUES ($1, $2, $3, true, NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET plan = $2, entity_limit = $3, updated_at = NOW()
    `, [req.user.sub, plan, entityLimit]);

    res.json({ success: true, plan, entity_limit: entityLimit });
  } catch (err) {
    console.error('Subscription upgrade error:', err);
    res.status(500).json({ error: 'Failed to upgrade subscription' });
  }
});

// ---------------------------------------------------------------------------
// PAYMENT INTEGRATION (Stripe)
// ---------------------------------------------------------------------------
app.post('/payment/create-session', authenticateToken, async (req, res) => {
  try {
    const { plan } = req.body;
    
    // Validate Stripe configuration
    if (!stripeKey || stripeKey === 'sk_test_your_stripe_secret_key_here') {
      console.error('❌ Stripe not configured: Using default key');
      return res.status(500).json({ error: 'Payment system not configured. Please contact support.' });
    }
    
    // Define pricing
    const prices = {
      premium: {
        amount: 999, // $9.99
        currency: 'usd',
        name: 'Premium Plan',
        description: 'Unlimited entities, advanced geofencing, priority support, and real-time alerts'
      }
    };

    if (!prices[plan]) {
      return res.status(400).json({ error: 'Invalid plan selected' });
    }

    console.log(`💳 Creating payment session for user ${req.user.sub} - Plan: ${plan}`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: prices[plan].currency,
          product_data: {
            name: prices[plan].name,
            description: prices[plan].description,
          },
          unit_amount: prices[plan].amount,
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${req.protocol}://${req.get('host')}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${req.protocol}://${req.get('host')}/payment/cancel`,
      customer_email: req.user.email || undefined,
      metadata: {
        user_id: req.user.sub,
        plan: plan
      }
    });

    console.log(`✅ Payment session created: ${session.id}`);
    res.json({ sessionId: session.id, url: session.url });
  } catch (err) {
    console.error('❌ Payment session creation error:', err.message);
    res.status(500).json({ error: 'Failed to create payment session: ' + err.message });
  }
});

app.get('/payment/success', (req, res) => {
  res.send(`
    <html>
      <head><title>Payment Success</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: #10b981;">🎉 Payment Successful!</h1>
        <p>Your premium subscription has been activated.</p>
        <p>You now have unlimited entities!</p>
        <button onclick="window.close()" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">Close Window</button>
      </body>
    </html>
  `);
});

app.get('/payment/cancel', (req, res) => {
  res.send(`
    <html>
      <head><title>Payment Cancelled</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1 style="color: #ef4444;">❌ Payment Cancelled</h1>
        <p>Your subscription was not upgraded.</p>
        <button onclick="window.close()" style="background: #3b82f6; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer;">Close Window</button>
      </body>
    </html>
  `);
});

// Webhook to handle successful payments
app.post('/payment/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_your_webhook_secret';

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.log(`Webhook signature verification failed.`, err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.user_id;
    const plan = session.metadata.plan;

    try {
      // Upgrade user to premium
      const entityLimit = plan === 'premium' ? 999999 : 4;
      await pool.query(`
        INSERT INTO subscriptions (user_id, plan, entity_limit, active, updated_at)
        VALUES ($1, $2, $3, true, NOW())
        ON CONFLICT (user_id)
        DO UPDATE SET plan = $2, entity_limit = $3, updated_at = NOW()
      `, [userId, plan, entityLimit]);

      console.log(`User ${userId} upgraded to ${plan} plan`);
    } catch (err) {
      console.error('Subscription upgrade error:', err);
    }
  }

  res.json({ received: true });
});

// ---------------------------------------------------------------------------
// DEVICE MANAGEMENT
// ---------------------------------------------------------------------------
app.get('/devices', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.json([]);

  try {
    const result = await pool.query(
      'SELECT * FROM devices WHERE user_id = $1 ORDER BY last_seen DESC',
      [req.user.sub]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Devices fetch error:', err);
    res.json([]);
  }
});

app.post('/devices/register', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database required' });

  try {
    const userAgent = req.headers['user-agent'] || '';
    const deviceInfo = parseUserAgent(userAgent);
    const { device_id, device_name, device_type } = req.body || {};

    const deviceId = device_id || crypto.randomUUID();
    const deviceName = device_name || `${deviceInfo.deviceType} - ${deviceInfo.browser} on ${deviceInfo.os}`;
    const deviceType = device_type || deviceInfo.deviceType;

    const result = await pool.query(
      `INSERT INTO devices (device_id, user_id, device_name, device_type, last_seen)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (device_id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         device_name = EXCLUDED.device_name,
         device_type = EXCLUDED.device_type,
         last_seen = NOW()
       RETURNING *`,
      [deviceId, req.user.sub, deviceName, deviceType]
    );

    const device = result.rows[0];
    console.log(`Device registered: ${deviceName} for user ${req.user.username}`);
    
    res.json(device);
  } catch (err) {
    console.error('Device registration error:', err);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

app.put('/devices/:deviceId/link-entity', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database required' });

  try {
    const { deviceId } = req.params;
    const { entityId } = req.body;
    
    // Verify device belongs to user
    const deviceCheck = await pool.query(
      'SELECT id FROM devices WHERE device_id = $1 AND user_id = $2',
      [deviceId, req.user.sub]
    );
    
    if (deviceCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Device not found or not owned by user' });
    }
    
    // Link device to entity
    await pool.query(
      'UPDATE entities SET device_id = $1, updated_at = NOW() WHERE entity_id = $2 AND owner_id = $3',
      [deviceId, entityId, req.user.sub]
    );
    
    // Update device last seen
    await pool.query(
      'UPDATE devices SET last_seen = NOW() WHERE device_id = $1',
      [deviceId]
    );
    
    res.json({ success: true, message: 'Device linked to entity successfully' });
  } catch (err) {
    console.error('Device linking error:', err);
    res.status(500).json({ error: 'Failed to link device to entity' });
  }
});

app.delete('/devices/:deviceId', authenticateToken, async (req, res) => {
  if (!dbConnected) return res.status(503).json({ message: 'Database required' });

  try {
    const { deviceId } = req.params;
    
    // Unlink device from entities first
    await pool.query(
      'UPDATE entities SET device_id = NULL WHERE device_id = $1 AND owner_id = $2',
      [deviceId, req.user.sub]
    );
    
    // Delete device
    await pool.query(
      'DELETE FROM devices WHERE device_id = $1 AND user_id = $2',
      [deviceId, req.user.sub]
    );
    
    res.json({ success: true });
  } catch (err) {
    console.error('Device deletion error:', err);
    res.status(500).json({ error: 'Failed to delete device' });
  }
});

// Helper function to parse user agent
function parseUserAgent(userAgent) {
  const ua = userAgent.toLowerCase();
  
  // Detect OS
  let os = 'Unknown';
  if (ua.includes('windows')) os = 'Windows';
  else if (ua.includes('macintosh') || ua.includes('mac os x')) os = 'macOS';
  else if (ua.includes('linux')) os = 'Linux';
  else if (ua.includes('android')) os = 'Android';
  else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';
  
  // Detect browser
  let browser = 'Unknown';
  if (ua.includes('chrome') && !ua.includes('edg')) browser = 'Chrome';
  else if (ua.includes('firefox')) browser = 'Firefox';
  else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
  else if (ua.includes('edg')) browser = 'Edge';
  else if (ua.includes('opera')) browser = 'Opera';
  
  // Detect device type
  let deviceType = 'desktop';
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    deviceType = 'mobile';
  } else if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceType = 'tablet';
  }
  
  return { os, browser, deviceType };
}

// ---------------------------------------------------------------------------
// PLACEHOLDER ENDPOINTS
// ---------------------------------------------------------------------------
app.post('/auth/forgot-password', (req, res) => {
  res.json({ message: 'Password reset email sent (feature coming soon)' });
});

// ---------------------------------------------------------------------------
// GOOGLE OAUTH
// ---------------------------------------------------------------------------
app.get('/auth/google', (req, res) => {
  if (!googleConfigured) {
    return res.status(400).json({ 
      message: 'Google OAuth is not configured',
      instructions: 'Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the server .env file'
    });
  }
  
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    accessType: 'offline'
  })(req, res);
});

app.get('/auth/google/callback', (req, res) => {
  if (!googleConfigured) {
    return res.status(400).redirect(`http://localhost:5176/?error=${encodeURIComponent('Google OAuth not configured')}`);
  }
  
  passport.authenticate('google', { session: false }, (err, user, info) => {
    if (err || !user) {
      console.error('Google OAuth callback error:', err);
      return res.redirect(`http://localhost:5176/?error=${encodeURIComponent(err?.message || 'Authentication failed')}`);
    }

    try {
      // Generate JWT token
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
      
      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5176';
      res.redirect(`${frontendUrl}?token=${encodeURIComponent(token)}&username=${encodeURIComponent(user.username)}&role=${encodeURIComponent(user.role)}&organization=${encodeURIComponent(user.organization || '')}`);
    } catch (err) {
      console.error('Token generation error:', err);
      res.redirect(`http://localhost:5176/?error=${encodeURIComponent('Token generation failed')}`);
    }
  })(req, res);
});

// ---------------------------------------------------------------------------
// MICROSOFT OAUTH
// ---------------------------------------------------------------------------
app.get('/auth/microsoft', (req, res) => {
  if (!microsoftConfigured) {
    return res.status(400).json({ 
      message: 'Microsoft OAuth is not configured',
      instructions: 'Set MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET in the server .env file'
    });
  }
  
  passport.authenticate('microsoft', { 
    scope: ['user.read'],
    accessType: 'offline'
  })(req, res);
});

app.get('/auth/microsoft/callback', (req, res) => {
  if (!microsoftConfigured) {
    return res.status(400).redirect(`http://localhost:5176/?error=${encodeURIComponent('Microsoft OAuth not configured')}`);
  }
  
  passport.authenticate('microsoft', { session: false }, (err, user, info) => {
    if (err || !user) {
      console.error('Microsoft OAuth callback error:', err);
      return res.redirect(`http://localhost:5176/?error=${encodeURIComponent(err?.message || 'Authentication failed')}`);
    }

    try {
      // Generate JWT token
      const token = jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
      
      // Redirect to frontend with token
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5176';
      res.redirect(`${frontendUrl}?token=${encodeURIComponent(token)}&username=${encodeURIComponent(user.username)}&role=${encodeURIComponent(user.role)}&organization=${encodeURIComponent(user.organization || '')}`);
    } catch (err) {
      console.error('Token generation error:', err);
      res.redirect(`http://localhost:5176/?error=${encodeURIComponent('Token generation failed')}`);
    }
  })(req, res);
});

// ---------------------------------------------------------------------------
// DEBUG ENDPOINT
// ---------------------------------------------------------------------------
app.get('/debug', authenticateToken, async (req, res) => {
  if (!dbConnected) {
    return res.json({ 
      mode: 'MEMORY',
      message: 'Database not connected - some features limited'
    });
  }

  try {
    const [users, entities, geofences, events, alerts] = await Promise.all([
      pool.query('SELECT id, username, role FROM users'),
      pool.query('SELECT COUNT(*) as count FROM entities'),
      pool.query('SELECT COUNT(*) as count FROM geofences'),
      pool.query('SELECT COUNT(*) as count FROM events'),
      pool.query('SELECT COUNT(*) as count FROM alerts')
    ]);

    res.json({
      dbConnected: true,
      users: users.rows.length,
      entities: Number(entities.rows[0].count),
      geofences: Number(geofences.rows[0].count),
      events: Number(events.rows[0].count),
      alerts: Number(alerts.rows[0].count),
      tables: ['users', 'entities', 'geofences', 'events', 'alerts']
    });
  } catch (err) {
    res.json({ dbConnected: true, error: 'Debug query failed', tables: ['users', 'entities', 'geofences', 'events', 'alerts'] });
  }
});

// ---------------------------------------------------------------------------
// SOCKET.IO HANDLERS
// ---------------------------------------------------------------------------
const setupSocketHandlers = (socket) => {
  console.log(`Client connected: ${socket.id}`);

  const orgRoom = getOrgRoom(socket.auth || {});
  socket.join(orgRoom);

  // Send initial data
  if (dbConnected) {
    getEntitiesForUser(socket.auth).then(entities => socket.emit('entities', entities));
    getGeofencesForUser(socket.auth).then(geofences => socket.emit('geofences', geofences));
  }

  // Location updates
  socket.on('locationUpdate', async (update) => {
    console.log('Location update:', update.entity_id || update.id);
    
    const entityId = update.entity_id || update.id;
    
    if (dbConnected) {
      // Update entity location
      pool.query(
        `UPDATE entities SET lat=$1, lng=$2, updated_at=NOW() WHERE id=$3 OR entity_id=$3`,
        [update.lat, update.lng, entityId]
      ).catch(console.error);
      
      // Check for geofence crossings
      try {
        const geofences = await getGeofencesForUser(socket.auth);
        const entityLocation = [update.lat, update.lng];
        
        for (const gf of geofences) {
          if (gf.coordinates && gf.coordinates.length > 0) {
            const isInside = pointInPolygon(entityLocation, gf.coordinates);
            
            // Check if this is a crossing (we'd need to track previous state)
            // For now, emit alerts when entities are detected inside geofences
            if (isInside) {
              io.to(orgRoom).emit('geofenceAlert', {
                entityId: entityId,
                geofenceName: gf.name,
                event: 'ENTER',
                timestamp: new Date().toISOString()
              });
              
              // Also save to alerts table
              pool.query(
                `INSERT INTO alerts (entity_id, issue_type, event, description, created_at)
                 VALUES ($1, 'geofence', 'ENTER', $2, NOW())`,
                [entityId, `Entered geofence: ${gf.name}`]
              ).catch(console.error);

              // Log audit event for geofence entry
              await logAuditEvent(null, 'ENTER', 'geofence', gf.id, { 
                entityId: entityId, 
                geofenceName: gf.name,
                event: 'geofence_entry'
              });
            }
          }
        }
      } catch (error) {
        console.error('Error checking geofence crossings:', error);
      }
    }

    socket.to(orgRoom).emit('locationUpdate', {
      id: entityId,
      lat: update.lat,
      lng: update.lng,
      timestamp: new Date().toISOString()
    });
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
const getAllEntities = async () => {
  if (!dbConnected) return [];
  try {
    const result = await pool.query('SELECT * FROM entities ORDER BY updated_at DESC LIMIT 1000');
    return result.rows;
  } catch {
    return [];
  }
};

const getOrgRoom = (user) => {
  const org = String(user?.organization || 'public').trim().replace(/\s+/g, '_').toLowerCase();
  return `org_${org}`;
};

const getEntitiesForUser = async (user) => {
  if (!dbConnected) return [];
  if (user?.role === 'admin') return getAllEntities();

  const result = await pool.query(
    `SELECT e.* FROM entities e
     JOIN users u ON e.owner_id = u.id
     WHERE (u.organization = $1 OR (u.organization IS NULL AND $1 IS NULL))
     ORDER BY e.updated_at DESC`,
    [user.organization]
  );
  return result.rows;
};

const getGeofencesForUser = async (user) => {
  if (!dbConnected) return [];
  if (user?.role === 'admin') {
    const result = await pool.query('SELECT * FROM geofences ORDER BY created_at DESC LIMIT 100');
    return result.rows.map(row => ({ ...row, coordinates: row.coordinates }));
  }

  const result = await pool.query(
    `SELECT g.* FROM geofences g
     JOIN users u ON g.user_id = u.id
     WHERE (u.organization = $1 OR (u.organization IS NULL AND $1 IS NULL))
     ORDER BY g.created_at DESC LIMIT 100`,
    [user.organization]
  );
  return result.rows.map(row => ({ ...row, coordinates: row.coordinates }));
};

const getAlertsForUser = async (user) => {
  if (!dbConnected) return [];
  if (user?.role === 'admin') {
    const result = await pool.query(`
      SELECT a.*, e.label as entity_label, e.type as entity_type 
      FROM alerts a 
      LEFT JOIN entities e ON a.entity_id::text = e.entity_id::text OR a.entity_id::text = e.id::text
      ORDER BY a.created_at DESC LIMIT 50
    `);
    return result.rows;
  }

  const result = await pool.query(`
      SELECT a.*, e.label as entity_label, e.type as entity_type 
      FROM alerts a 
      LEFT JOIN entities e ON a.entity_id::text = e.entity_id::text OR a.entity_id::text = e.id::text
      LEFT JOIN users u ON e.owner_id = u.id OR a.user_id = u.id
      WHERE (u.organization = $1 OR (u.organization IS NULL AND $1 IS NULL))
      ORDER BY a.created_at DESC LIMIT 50
  `, [user.organization]);
  return result.rows;
};

const getEventsForUser = async (user) => {
  if (!dbConnected) return [];
  if (user?.role === 'admin') {
    const result = await pool.query('SELECT * FROM events ORDER BY timestamp DESC LIMIT 50');
    return result.rows;
  }

  const result = await pool.query(`
      SELECT ev.* 
      FROM events ev 
      LEFT JOIN entities e ON ev.entity_id::text = e.entity_id::text OR ev.entity_id::text = e.id::text
      LEFT JOIN users u ON e.owner_id = u.id OR ev.user_id = u.id
      WHERE (u.organization = $1 OR (u.organization IS NULL AND $1 IS NULL))
      ORDER BY ev.timestamp DESC LIMIT 50
  `, [user.organization]);
  return result.rows;
};

const getLocationHistoryForUser = async (user, hours, limit) => {
  if (!dbConnected) return [];
  if (user?.role === 'admin') {
    const result = await pool.query(
      `SELECT entity_id, lat, lng, timestamp, source
       FROM location_history
       WHERE timestamp > NOW() - INTERVAL '${hours} hours'
       ORDER BY timestamp DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  }

  const result = await pool.query(
      `SELECT lh.entity_id, lh.lat, lh.lng, lh.timestamp, lh.source
       FROM location_history lh
       JOIN entities e ON lh.entity_id::text = e.entity_id::text OR lh.entity_id::text = e.id::text
       JOIN users u ON e.owner_id = u.id
       WHERE (u.organization = $1 OR (u.organization IS NULL AND $1 IS NULL))
         AND lh.timestamp > NOW() - INTERVAL '${hours} hours'
       ORDER BY lh.timestamp DESC
       LIMIT $2`,
      [user.organization, limit]
  );
  return result.rows;
};

// ---------------------------------------------------------------------------
// SERVER START
// ---------------------------------------------------------------------------
const startServer = async () => {
  const server = http.createServer(app);
  io = new Server(server, { 
    cors: { origin: '*' },
    auth: {
      // Socket auth middleware
      parse: (header) => {
        const token = header?.token;
        try {
          return jwt.verify(token, JWT_SECRET);
        } catch {
          return null;
        }
      }
    }
  });

  // Socket connection handler
  io.on('connection', (socket) => {
    // Verify token from auth handshake
    if (!socket.auth || !socket.auth.username) {
      socket.disconnect();
      return;
    }

    console.log(`Authenticated socket: ${socket.auth.username}`);
    setupSocketHandlers(socket);
  });

  try {
    await pool.query('SELECT 1');
    dbConnected = true;
    console.log('✅ PostgreSQL connected');
    
    // Create tables if they don't exist
    await createTables();
    
    // Start entity movement simulation
    startEntityMovement();
  } catch (err) {
    dbConnected = false;
    console.warn('⚠️  Running in MEMORY mode:', err.message);
  }

  return new Promise((resolve, reject) => {
    server.listen(PORT, () => {
      console.log(`🚀 Server running → http://localhost:${PORT}`);
      console.log(`📊 Debug: http://localhost:${PORT}/debug`);
      resolve(server);
    });
    server.on('error', reject);
  });
};

if (require.main === module) {
  startServer().catch((err) => {
    console.error('💥 Startup failed', err);
    process.exit(1);
  });
}

module.exports = { app, startServer };