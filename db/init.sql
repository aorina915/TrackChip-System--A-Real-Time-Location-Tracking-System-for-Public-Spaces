-- Run this script in PostgreSQL with PostGIS extension enabled.
CREATE DATABASE trackchip;
\c trackchip;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  email TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'client',
  reset_token TEXT,
  reset_token_expiry TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE geofences (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  coordinates JSONB NOT NULL,
  type TEXT DEFAULT 'social',
  user_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE location_history (
  id SERIAL PRIMARY KEY,
  entity_id TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  source TEXT NOT NULL
);

CREATE TABLE entities (
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
);

CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  device_id TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  device_name TEXT NOT NULL,
  device_type TEXT DEFAULT 'phone',
  is_active BOOLEAN DEFAULT TRUE,
  last_seen TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  entity_id TEXT,
  event TEXT NOT NULL,
  label TEXT,
  status TEXT DEFAULT 'pending',
  attended_at TIMESTAMPTZ,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE alerts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  entity_id TEXT,
  issue_type TEXT NOT NULL, -- 'stolen', 'damaged', 'lost', 'suspicious'
  description TEXT,
  status TEXT DEFAULT 'pending', -- 'pending', 'resolved', 'dismissed'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Sample geofence
INSERT INTO geofences(name, coordinates) VALUES
('Campus Core', '[[36.8165, -1.2870], [36.8195, -1.2870], [36.8195, -1.2850], [36.8165, -1.2850], [36.8165, -1.2870]]'::jsonb);
