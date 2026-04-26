import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polygon,
  Polyline,
} from "react-leaflet";
import { io } from "socket.io-client";
import toast, { Toaster } from "react-hot-toast";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import TrackingPanel from "./components/TrackingPanel";
import EntityMarker from "./components/EntityMarker";
import TrackingSystemDoc from "./components/TrackingSystemDoc";
import DeviceManager from "./components/DeviceManager";
import AddEntity from "./components/AddEntity";
import ActivityLogs from "./components/ActivityLogs";
import { scheduleTokenRefresh } from "./utils/auth";

/* ------------------ POLYGON CHECK ------------------ */
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

/* ------------------ FIX MARKERS ------------------ */
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const SERVER_URL = process.env.VITE_SERVER_URL || "http://localhost:4000";

/* ------------------ ALERT SOUND ------------------ */
// Shared Audio instance for exit/issue sounds
const alertSound = new Audio("/alert.mp3");
alertSound.volume = 0.6;
let alertSoundTimeout = null;
// Global sound settings
let soundAlertsEnabled = true;

const stopAlertSound = () => {
  if (alertSoundTimeout) {
    clearTimeout(alertSoundTimeout);
    alertSoundTimeout = null;
  }
  try {
    alertSound.pause();
    alertSound.currentTime = 0;
  } catch (err) {
    // ignore playback reset errors
  }
};

const playAlertSound = () => {
  if (!soundAlertsEnabled) return;
  stopAlertSound();
  alertSound.currentTime = 0;
  alertSound.play().catch(() => {
    // Browsers block autoplay until the user has interacted with the page.
    // The catch prevents an unhandled-rejection console error.
  });
  alertSoundTimeout = setTimeout(() => {
    stopAlertSound();
  }, 3000);
};

const playEnterSound = () => {
  if (!soundAlertsEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.2;

    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.25);

    oscillator.onended = () => {
      gain.disconnect();
      oscillator.disconnect();
      ctx.close?.();
    };
  } catch (err) {
    console.error('Enter sound playback error:', err);
  }
};

const playSoundForEvent = (eventName) => {
  if (eventName === 'ENTER') {
    playEnterSound();
  } else {
    playAlertSound();
  }
};

function App() {
  const [token, setToken] = useState(() => {
    try {
      const storedToken = localStorage.getItem("tc_token");
      console.log('Initializing token:', storedToken ? 'present' : 'not present');
      // Validate token format (basic check)
      if (storedToken && storedToken.length > 10) {
        console.log('Token appears valid, length:', storedToken.length);
        return storedToken;
      }
      // Clear invalid token
      console.log('Token invalid or missing, clearing localStorage');
      localStorage.removeItem("tc_token");
      localStorage.removeItem("tc_user");
      return "";
    } catch (error) {
      console.error('Error reading token from localStorage:', error);
      localStorage.removeItem("tc_token");
      localStorage.removeItem("tc_user");
      return "";
    }
  });
  const [user, setUser] = useState(() => {
    try {
      const storedUser = localStorage.getItem("tc_user");
      console.log('Initializing user:', storedUser ? 'present' : 'not present');
      if (storedUser) {
        const parsed = JSON.parse(storedUser);
        if (parsed && typeof parsed === 'object') {
          console.log('User parsed successfully:', parsed.username);
          return parsed;
        }
      }
      console.log('No valid user data in localStorage');
      return null;
    } catch (error) {
      console.error('Error parsing user from localStorage:', error);
      localStorage.removeItem("tc_user");
      return null;
    }
  });
  const [route, setRoute] = useState(() => {
    const hash = window.location.hash.replace('#', '') || '/dashboard';
    const page = hash.startsWith('/') ? hash.slice(1) : hash;
    return ['dashboard', 'docs', 'devices', 'login'].includes(page) ? page : 'dashboard';
  });
  const showDocs = route === 'docs';
  const isDeviceManagerOpen = route === 'devices';

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash.replace('#', '') || '/dashboard';
      const page = hash.startsWith('/') ? hash.slice(1) : hash;
      const allowedPages = user?.role === 'admin' 
        ? ['dashboard', 'docs', 'devices', 'login'] 
        : ['dashboard', 'devices', 'login'];
      if (allowedPages.includes(page)) {
        setRoute(page);
      } else {
        setRoute('dashboard');
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [user]);

  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [isAddEntityOpen, setIsAddEntityOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState('general');

  const [login, setLogin] = useState({ username: "", password: "" });

  const [authMode, setAuthMode] = useState("login");
  const [registerData, setRegisterData] = useState({
    username: "",
    password: "",
    email: "",
    organization: "",
    role: "client",
  });
  const [resetEmail, setResetEmail] = useState("");

  const [entities, setEntities] = useState([]);
  const entitiesRef = useRef([]);
  const [geofences, setGeofences] = useState([]);
  const [alerts, setAlerts] = useState(() => {
    try {
      const stored = localStorage.getItem('tc_alerts');
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      console.error('Error reading alerts from localStorage:', err);
      return [];
    }
  });
  const [locationHistory, setLocationHistory] = useState([]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [showHeatmapControls, setShowHeatmapControls] = useState(false);
  const [heatmapSettings, setHeatmapSettings] = useState({
    timeRange: '6h',
    opacity: 0.7,
    radius: 15,
    blur: 20,
    entityFilter: 'all'
  });

  const [userSettings, setUserSettings] = useState(() => {
    try {
      const stored = localStorage.getItem('tc_user_settings');
      return stored ? JSON.parse(stored) : {
        theme: 'dark',
        soundAlerts: true,
        autoRefresh: 0,
        mapStyle: 'osm'
      };
    } catch (err) {
      console.error('Error reading user settings from localStorage:', err);
      return {
        theme: 'dark',
        soundAlerts: true,
        autoRefresh: 0,
        mapStyle: 'osm'
      };
    }
  });

  // Handle OAuth callback parameters from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthToken = params.get('token');
    const oauthError = params.get('error');
    const username = params.get('username');
    const role = params.get('role');
    const organization = params.get('organization');

    if (oauthError) {
      setAuthError(`OAuth Error: ${decodeURIComponent(oauthError)}`);
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    if (oauthToken) {
      // Save token and user info from OAuth callback
      try {
        localStorage.setItem('tc_token', oauthToken);
        localStorage.setItem('tc_user', JSON.stringify({
          username: decodeURIComponent(username || 'User'),
          role: decodeURIComponent(role || 'client'),
          organization: decodeURIComponent(organization || '')
        }));
        setToken(oauthToken);
        setUser({
          username: decodeURIComponent(username || 'User'),
          role: decodeURIComponent(role || 'client'),
          organization: decodeURIComponent(organization || '')
        });
        setRoute('dashboard');
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (err) {
        console.error('Error handling OAuth callback:', err);
        setAuthError('Failed to process OAuth login');
      }
    }
  }, []);

  const [entityStatus, setEntityStatus] = useState({});
  const [entityHistory, setEntityHistory] = useState({});
  const [showEventPanel, setShowEventPanel] = useState(true);
  const prevStatusRef = useRef({});
  const heatmapRef = useRef(null);

  // Schedule token refresh on app start if token exists
  // useEffect(() => {
  //   if (token) {
  //     scheduleTokenRefresh(token, setToken, SERVER_URL);
  //   }
  // }, []);

  const mapRef = useRef(null);
  const mapCenter = [-1.286389, 36.817223];

  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } : null),
    [token]
  );

  useEffect(() => {
    entitiesRef.current = entities;
  }, [entities]);

  const loadAllData = async (currentToken) => {
    if (!currentToken) return;
    setDataLoading(true);
    const apiHeaders = { Authorization: `Bearer ${currentToken}`, "Content-Type": "application/json" };
    try {
      // Fetch all data in parallel with shorter timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout for faster loading
      
      const [entitiesRes, geofencesRes, locationRes] = await Promise.all([
        fetch(`${SERVER_URL}/entities`, { headers: apiHeaders, signal: controller.signal }),
        fetch(`${SERVER_URL}/geofences`, { headers: apiHeaders, signal: controller.signal }),
        fetch(`${SERVER_URL}/location-history?hours=6&limit=500`, { headers: apiHeaders, signal: controller.signal })
      ]).finally(() => clearTimeout(timeoutId));

      let entitiesData = [];
      let geofencesData = [];

      // Process responses with safe guards
      if (entitiesRes?.ok) {
        try {
          entitiesData = await entitiesRes.json();
          setEntities(Array.isArray(entitiesData) ? entitiesData.slice(0, 1000) : []);
        } catch (e) {
          console.error('Error parsing entities:', e);
          setEntities([]);
        }
      }
      if (geofencesRes?.ok) {
        try {
          geofencesData = await geofencesRes.json();
          setGeofences(Array.isArray(geofencesData) ? geofencesData.slice(0, 100) : []);
        } catch (e) {
          console.error('Error parsing geofences:', e);
          setGeofences([]);
        }
      }
      if (locationRes?.ok) {
        try {
          const data = await locationRes.json();
          setLocationHistory(Array.isArray(data) ? data.slice(0, 500) : []);
        } catch (e) {
          console.error('Error parsing location history:', e);
          setLocationHistory([]);
        }
      }

      // Check for geofence entries on login
      entitiesData.forEach(entity => {
        geofencesData.forEach(gf => {
          if (gf.coordinates && pointInPolygon([entity.lng, entity.lat], gf.coordinates)) {
            triggerAlert({
              entityId: entity.id,
              label: entity.label,
              event: "ENTER",
              timestamp: new Date(),
            });
          }
        });
      });

    } catch (err) {
      console.error('Error loading data:', err);
      if (err.name !== 'AbortError') {
        console.warn('Request timeout - serving partial data');
      }
      // Don't show error toast on timeout - app should still work
    } finally {
      setDataLoading(false);
    }
  };

  // Separate function to load only events (for initial load)
  const loadInitialEvents = async (currentToken) => {
    if (!currentToken) return;
    const apiHeaders = { Authorization: `Bearer ${currentToken}`, "Content-Type": "application/json" };
    try {
      const eventsRes = await fetch(`${SERVER_URL}/events?limit=100`, { headers: apiHeaders });
      if (eventsRes?.ok) {
        try {
          const data = await eventsRes.json();
          if (Array.isArray(data)) {
            setAlerts(data.reverse().slice(0, 50));
          }
        } catch (e) {
          console.error('Error parsing events:', e);
        }
      }
    } catch (err) {
      console.error('Error loading events:', err);
    }
  };

  // Function to fetch entities (used by TrackingPanel)
  const fetchEntities = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${SERVER_URL}/entities`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
      });
      if (res.ok) {
        const data = await res.json();
        setEntities(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching entities:', err);
    }
  };

  const switchMode = (mode) => {
    setAuthError("");
    setAuthMode(mode);
  };

  const parseError = async (res) => {
    try {
      const j = await res.json();
      return j.message || "Something went wrong";
    } catch {
      return `Error ${res.status}`;
    }
  };

  const setRouteHash = (page) => {
    const normalized = page === 'login' ? 'login' : page === 'docs' ? 'docs' : page === 'devices' ? 'devices' : 'dashboard';
    if (window.location.hash !== `#/${normalized}`) {
      window.location.hash = `#/${normalized}`;
    }
    setRoute(normalized);
  };

  const saveSession = (token, user) => {
    localStorage.setItem("tc_token", token);
    localStorage.setItem("tc_user", JSON.stringify(user));
    setToken(token);
    setUser(user);
    setRouteHash('dashboard');
    // scheduleTokenRefresh(token, setToken, SERVER_URL);
  };

  /* ------------------ LOGIN ------------------ */
  const doLogin = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(login),
      });
      if (!res.ok) { setAuthError(await parseError(res)); return; }
      const body = await res.json();
      saveSession(body.token, { username: body.username, role: body.role, organization: body.organization || '' });
      // Clear login form for security after successful login
      setLogin({ username: "", password: "" });
    } catch {
      setAuthError("Cannot reach server. Is it running?");
    } finally {
      setAuthLoading(false);
    }
  };

  /* ------------------ REGISTER ------------------ */
  const doRegister = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(registerData),
      });
      if (!res.ok) { setAuthError(await parseError(res)); return; }
      const body = await res.json();
      saveSession(body.token, { username: body.username, role: body.role, organization: body.organization || '' });
      playAlertSound();
      toast.success("Account created successfully!");
      // Clear login form for security after successful registration
      setLogin({ username: "", password: "" });
    } catch {
      setAuthError("Cannot reach server. Is it running?");
    } finally {
      setAuthLoading(false);
    }
  };

  /* ------------------ FORGOT PASSWORD ------------------ */
  const doForgotPassword = async (e) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });
      if (!res.ok) { setAuthError(await parseError(res)); return; }
      playAlertSound();
      toast.success("Password reset email sent!");
      switchMode("login");
    } catch {
      setAuthError("Cannot reach server. Is it running?");
    } finally {
      setAuthLoading(false);
    }
  };

  /* ------------------ LOGOUT ------------------ */
  const doLogout = () => {
    localStorage.removeItem("tc_token");
    localStorage.removeItem("tc_user");
    localStorage.removeItem("tc_alerts");
    setDataLoading(false);
    setEntities([]);
    setGeofences([]);
    setAlerts([]);
    setLocationHistory([]);
    setToken("");
    setUser(null);
    // Clear login form fields for security
    setLogin({ username: "", password: "" });
    setAuthError("");
    setRouteHash('login');
  };

  /* ------------------ SAVE USER SETTINGS ------------------ */
  const saveUserSettings = (newSettings) => {
    try {
      localStorage.setItem('tc_user_settings', JSON.stringify(newSettings));
      setUserSettings(newSettings);
      
      // Apply settings immediately
      applyUserSettings(newSettings);
      
      toast.success('Settings saved successfully!');
    } catch (err) {
      console.error('Error saving user settings:', err);
      toast.error('Failed to save settings');
    }
  };

  /* ------------------ APPLY USER SETTINGS ------------------ */
  const applyUserSettings = (settings) => {
    // Apply theme
    if (settings.theme === 'light') {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.body.style.backgroundColor = '#ffffff';
      document.body.style.color = '#000000';
    } else {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      document.body.style.backgroundColor = '#1a1a1a';
      document.body.style.color = '#ffffff';
    }
    
    // Apply sound alerts setting
    soundAlertsEnabled = settings.soundAlerts;
    console.log(`Sound alerts ${settings.soundAlerts ? 'enabled' : 'disabled'}`);
    
    // Apply auto-refresh setting
    if (settings.autoRefresh > 0) {
      // Auto-refresh is handled in the data loading effect
      console.log(`Auto-refresh set to ${settings.autoRefresh} seconds`);
    }
    
    // Apply map style (if implemented)
    if (settings.mapStyle === 'satellite') {
      // Satellite view would be implemented here
      console.log('Satellite map style selected');
    } else {
      console.log('OpenStreetMap style selected');
    }
  };

  /* ------------------ PERSIST ALERTS ACROSS REFRESH ------------------ */
  useEffect(() => {
    try {
      localStorage.setItem('tc_alerts', JSON.stringify(alerts));
    } catch (err) {
      console.error('Error saving alerts to localStorage:', err);
    }
  }, [alerts]);

  /* ------------------ APPLY USER SETTINGS ON LOAD/CHANGE ------------------ */
  useEffect(() => {
    applyUserSettings(userSettings);
  }, [userSettings]);

  /* ------------------ LOAD ALL DATA ON LOGIN/TOKEN CHANGE ------------------ */
  useEffect(() => {
    if (!token) {
      setRouteHash('login');
      setDataLoading(false);
      return;
    }

    // preserve the current page if the user reloads the browser,
    // but if the hash is explicitly login, redirect to dashboard.
    const hashRoute = window.location.hash.replace('#', '') || '/dashboard';
    const page = hashRoute.startsWith('/') ? hashRoute.slice(1) : hashRoute;
    if (page === 'login') {
      setRouteHash('dashboard');
    } else if (['dashboard', 'docs', 'devices'].includes(page)) {
      setRoute(page);
    } else {
      setRouteHash('dashboard');
    }

    // Load all data (entities, geofences, location history)
    loadAllData(token);
    // Load initial events separately
    loadInitialEvents(token);
  }, [token, user]);

  /* ------------------ AUTO-REFRESH DATA ------------------ */
  useEffect(() => {
    if (!token || userSettings.autoRefresh <= 0) return;

    const interval = setInterval(() => {
      console.log(`Auto-refreshing data every ${userSettings.autoRefresh} seconds`);
      loadAllData(token);
    }, userSettings.autoRefresh * 1000);

    return () => clearInterval(interval);
  }, [token, userSettings.autoRefresh]);

  /* ------------------ SOCKET ------------------ */
  useEffect(() => {
    if (!token) return;

    const socket = io(SERVER_URL, { 
      auth: { token },
      reconnectionDelay: 500,
      reconnection: true,
      reconnectionDelayMax: 3000,
      reconnectionAttempts: 5,
      transports: ['websocket', 'polling'],
      upgrade: true
    });

    // Connection error handling
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
    });

    socket.on("entities", (data) => {
      // Limit entities to prevent lag
      setEntities(Array.isArray(data) ? data.slice(0, 1000) : []);
    });
    
    socket.on("geofences", (data) => {
      // Limit geofences to prevent lag
      setGeofences(Array.isArray(data) ? data.slice(0, 100) : []);
    });

    socket.on("locationUpdate", (update) => {
      if (!update || !update.id) return;
      setEntities((prev) =>
        prev.map((e) =>
          e.id === update.id || e.entity_id === update.id
            ? { ...e, lat: update.lat, lng: update.lng, updated_at: update.timestamp }
            : e
        )
      );
    });

    socket.on("entityCreated", (entity) => {
      if (!entity || !entity.id) return;
      setEntities((prev) => {
        const limited = prev.length >= 1000 ? prev.slice(0, 999) : prev;
        return [...limited, entity];
      });
      playAlertSound();
      toast.success(`Entity "${entity.label}" tracking started`);
    });

    socket.on("entityUpdated", (entity) => {
      setEntities((prev) =>
        prev.map((e) =>
          e.id === entity.id || e.entity_id === entity.entity_id ? entity : e
        )
      );
    });

    socket.on("entityDeleted", (id) => {
      setEntities((prev) => prev.filter((e) => e.id !== id && e.entity_id !== id));
    });

    socket.on("geofenceAlert", (alert) => {
      triggerAlert({
        entityId: alert.entityId,
        label: `${alert.geofenceName} - ${alert.entityId}`,
        event: alert.event,
        timestamp: new Date(alert.timestamp),
      });
    });

    socket.on("entityAlert", (alert) => {
      triggerAlert({
        entityId: alert.entityId,
        label: `${alert.issue_type.toUpperCase()}: ${alert.description}`,
        event: "ALERT",
        timestamp: new Date(alert.timestamp),
      });
    });

    return () => socket.disconnect();
  }, [token]);

  /* ------------------ PERSIST EVENT ------------------ */
  const persistEvent = async (alert) => {
    if (!headers) return;
    try {
      await fetch(`${SERVER_URL}/events`, {
        method: "POST",
        headers,
        body: JSON.stringify(alert),
      });
    } catch (err) {
      console.error('Error persisting event:', err);
    }
  };

  const formatEntityLocation = (alert) => {
    if (typeof alert.lat === 'number' && typeof alert.lng === 'number') {
      return `${alert.lat.toFixed(5)}, ${alert.lng.toFixed(5)}`;
    }
    if (alert.location) return alert.location;
    return '';
  };

  const enrichAlert = (alert) => {
    const entity = entitiesRef.current.find(
      (e) => String(e.id) === String(alert.entityId) || String(e.entity_id) === String(alert.entityId)
    );

    const entityName = entity?.label || alert.label || 'Unknown entity';
    const entityType = entity?.type || alert.entityType || '';
    const location = entity?.lat != null && entity?.lng != null
      ? `${entity.lat.toFixed(5)}, ${entity.lng.toFixed(5)}`
      : formatEntityLocation(alert);

    return {
      ...alert,
      entityName,
      entityType,
      location,
    };
  };

  const toastAlertContent = (alert) => {
    const enriched = enrichAlert(alert);
    return (
      <div className="space-y-1">
        <div className="font-semibold text-sm">
          {enriched.event} → {enriched.entityName}
        </div>
        {enriched.entityType && (
          <div className="text-xs text-gray-200">Type: {enriched.entityType}</div>
        )}
        {enriched.location && (
          <div className="text-xs text-gray-200">Location: {enriched.location}</div>
        )}
      </div>
    );
  };

  const handleLiveAlertEvent = useCallback((alert) => {
    const enriched = enrichAlert(alert);
    setAlerts((prev) => [enriched, ...prev].slice(0, 20));
    persistEvent(enriched);
  }, [enrichAlert, persistEvent]);

  const handleGeofenceView = useCallback((geofence) => {
    if (!mapRef.current) return;
    try {
      const bounds = L.latLngBounds(geofence.coordinates);
      mapRef.current.flyToBounds(bounds, { padding: [40, 40], duration: 1.2 });
    } catch (err) {
      console.error('Error centering main map on geofence:', err);
    }
  }, []);

  /* ------------------ TRIGGER ALERT ------------------ */
  // All toasts funnel through here — one place to play the sound
  const triggerAlert = (alert) => {
    const enriched = enrichAlert(alert);
    playSoundForEvent(enriched.event);
    toast(toastAlertContent(enriched), { duration: 5000 });
    setAlerts((prev) => [enriched, ...prev].slice(0, 20));
    persistEvent(enriched);
  };

  /* ------------------ GEOFENCE DETECTION ------------------ */
  useEffect(() => {
    const statusMap = {};

    entities.forEach((entity) => {
      let insideAny = false;
      geofences.forEach((gf) => {
        if (gf.coordinates && pointInPolygon([entity.lat, entity.lng], gf.coordinates))
          insideAny = true;
      });

      const newStatus = insideAny ? "inside" : "outside";
      const prevStatus = prevStatusRef.current[entity.id];

      if (prevStatus && prevStatus !== newStatus) {
        triggerAlert({
          entityId: entity.id,
          label: entity.label,
          event: newStatus === "inside" ? "ENTER" : "EXIT",
          timestamp: new Date(),
        });
      }

      statusMap[entity.id] = newStatus;

      setEntityHistory((prev) => ({
        ...prev,
        [entity.id]: [
          { lat: entity.lat, lng: entity.lng },
          ...(prev[entity.id] || []),
        ].slice(0, 50),
      }));
    });

    prevStatusRef.current = statusMap;
    setEntityStatus(statusMap);
  }, [entities, geofences]);

  /* ------------------ HEATMAP SETUP ------------------ */
  useEffect(() => {
    if (!mapRef.current || !showHeatmap || locationHistory.length === 0) {
      // Remove heatmap if disabled
      if (heatmapRef.current) {
        mapRef.current.removeLayer(heatmapRef.current);
        heatmapRef.current = null;
      }
      return;
    }

    const map = mapRef.current;
    const L = window.L;

    if (!L || !L.heatLayer) return;

    // Remove existing heatmap
    if (heatmapRef.current) {
      map.removeLayer(heatmapRef.current);
    }

    // Filter location history by time range and entity
    const now = new Date();
    let timeFilter = now.getTime();

    switch (heatmapSettings.timeRange) {
      case '1h':
        timeFilter = now.getTime() - (60 * 60 * 1000);
        break;
      case '6h':
        timeFilter = now.getTime() - (6 * 60 * 60 * 1000);
        break;
      case '24h':
        timeFilter = now.getTime() - (24 * 60 * 60 * 1000);
        break;
      case '7d':
        timeFilter = now.getTime() - (7 * 24 * 60 * 60 * 1000);
        break;
      default:
        timeFilter = now.getTime() - (6 * 60 * 60 * 1000);
    }

    let filteredHistory = locationHistory.filter(point => {
      const pointTime = new Date(point.timestamp).getTime();
      const entityMatch = heatmapSettings.entityFilter === 'all' || point.entity_id === heatmapSettings.entityFilter;
      return pointTime >= timeFilter && entityMatch;
    });

    if (filteredHistory.length === 0) {
      console.log('No location data for current heatmap settings');
      return;
    }

    // Create heatmap data points with intensity based on recency
    const heatData = filteredHistory.map(point => {
      const pointTime = new Date(point.timestamp).getTime();
      const age = (now.getTime() - pointTime) / (1000 * 60 * 60); // hours old
      let intensity = 0.8;

      // More recent points are hotter
      if (age < 1) intensity = 1.0; // last hour
      else if (age < 6) intensity = 0.8; // last 6 hours
      else if (age < 24) intensity = 0.6; // last 24 hours
      else intensity = 0.4; // older

      return [point.lat, point.lng, intensity];
    });

    // Add heatmap layer with custom settings
    heatmapRef.current = L.heatLayer(heatData, {
      radius: heatmapSettings.radius,
      blur: heatmapSettings.blur,
      maxZoom: 16,
      max: 1.0,
      gradient: {
        0.2: 'blue',
        0.4: 'lime',
        0.6: 'yellow',
        0.8: 'orange',
        1.0: 'red'
      }
    }).addTo(map);

    // Apply opacity
    if (heatmapRef.current && heatmapRef.current._canvas) {
      heatmapRef.current._canvas.style.opacity = heatmapSettings.opacity;
    }

    return () => {
      if (heatmapRef.current) {
        map.removeLayer(heatmapRef.current);
        heatmapRef.current = null;
      }
    };
  }, [locationHistory, showHeatmap, heatmapSettings]);

  /* ------------------ LOADING OVERLAY ------------------ */
  const LoadingOverlay = () => (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="glass p-8 rounded-lg flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-primary font-semibold">Loading your dashboard...</p>
      </div>
    </div>
  );

  /* ------------------ MAIN UI ------------------ */
  // Safety check: if we have no token but somehow got here, show auth UI
  if (!token || !user) {
    console.log('No valid token/user, showing auth UI');
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-slate-900 bg-cover bg-center relative overflow-auto"
        style={{
          backgroundImage: "url('/Trackchip.jpg')",
          backgroundPosition: 'center',
          backgroundSize: 'cover'
        }}
      >
        {/* DARK OVERLAY */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {/* ANIMATED PARTICLES */}
        <div className="absolute inset-0">
          {[...Array(40)].map((_, i) => (
            <span
              key={i}
              className="absolute w-1 h-1 bg-cyan-400 rounded-full animate-ping"
              style={{
                top: Math.random() * 100 + "%",
                left: Math.random() * 100 + "%",
                animationDuration: 2 + Math.random() * 3 + "s",
                opacity: 0.3,
              }}
            />
          ))}
        </div>

        {/* MAP GRID EFFECT */}
        <div className="absolute inset-0 opacity-10">
          <div className="w-full h-full bg-[linear-gradient(transparent_95%,rgba(0,255,255,0.3)_100%),linear-gradient(90deg,transparent_95%,rgba(0,255,255,0.3)_100%)] bg-[size:40px_40px]" />
        </div>

        {/* LOGIN CARD */}
        <div className="relative z-10 bg-black/80 backdrop-blur-lg p-8 rounded-2xl border border-cyan-500/20 shadow-2xl max-w-md w-full mx-4">

          {/* HEADER */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full mx-auto mb-4 overflow-hidden border-2 border-cyan-500/40 shadow-lg shadow-cyan-500/20">
              <img
                src="/trackchip_logo.jpg"
                alt="TrackChip Logo"
                className="w-full h-full object-cover"
              />
            </div>
            <h1 className="text-3xl font-bold text-white mb-1">TrackChip</h1>
            <p className="text-cyan-400 text-sm">Real-Time Entity Tracking</p>
          </div>

          {/* MODE SWITCH */}
          <div className="flex mb-6 bg-slate-800 rounded-lg p-1">
            {["login", "register", "forgot"].map((mode) => (
              <button
                key={mode}
                onClick={() => switchMode(mode)}
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition capitalize ${
                  authMode === mode
                    ? "bg-cyan-500 text-black"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {mode === "forgot"
                  ? "Reset"
                  : mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* ERROR */}
          {authError && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-red-900/50 border border-red-500/40 text-red-300 text-sm flex items-center gap-2">
              <span>⚠️</span> {authError}
            </div>
          )}

          {/* LOGIN */}
          {authMode === "login" && (
            <form onSubmit={doLogin} className="space-y-4">
              <h2 className="text-white text-xl font-semibold text-center">Welcome Back</h2>
              <input
                className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white"
                placeholder="Username"
                value={login.username}
                onChange={(e) => setLogin({ ...login, username: e.target.value })}
                required
              />
              <input
                type="password"
                className="w-full p-3 bg-slate-800 border border-slate-600 rounded-lg text-white"
                placeholder="Password"
                value={login.password}
                onChange={(e) => setLogin({ ...login, password: e.target.value })}
                required
              />
              <button
                disabled={authLoading}
                className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-semibold py-3 rounded-lg"
              >
                {authLoading ? "Signing in…" : "Login"}
              </button>

              <div className="text-center space-y-2">
                <button type="button" onClick={() => switchMode("forgot")} className="text-cyan-400 text-sm">
                  Forgot Password?
                </button>

                <div className="text-gray-400 text-sm">or</div>

                <button
                  type="button"
                  onClick={() => (window.location.href = `${SERVER_URL}/auth/google`)}
                  className="w-full bg-red-600 text-white py-2 rounded-lg text-sm"
                >
                  Continue with Google
                </button>

                <button
                  type="button"
                  onClick={() => (window.location.href = `${SERVER_URL}/auth/microsoft`)}
                  className="w-full bg-blue-600 text-white py-2 rounded-lg text-sm"
                >
                  Continue with Microsoft
                </button>
              </div>
            </form>
          )}

          {/* REGISTER */}
          {authMode === "register" && (
            <form onSubmit={doRegister} className="space-y-4">
              <h2 className="text-white text-xl text-center">Create Account</h2>
              <input
                className="w-full p-3 bg-slate-800 rounded-lg text-white"
                placeholder="Username"
                value={registerData.username}
                onChange={(e) => setRegisterData({ ...registerData, username: e.target.value })}
                required
              />
              <input
                type="email"
                className="w-full p-3 bg-slate-800 rounded-lg text-white"
                placeholder="Email"
                value={registerData.email}
                onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                required
              />
              <input
                type="password"
                className="w-full p-3 bg-slate-800 rounded-lg text-white"
                placeholder="Password"
                value={registerData.password}
                onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                required
              />
              <input
                type="text"
                className="w-full p-3 bg-slate-800 rounded-lg text-white"
                placeholder="Organization"
                value={registerData.organization}
                onChange={(e) => setRegisterData({ ...registerData, organization: e.target.value })}
                required
              />
              <button className="w-full bg-green-600 py-3 rounded-lg text-white">
                Create Account
              </button>
            </form>
          )}

          {/* FORGOT */}
          {authMode === "forgot" && (
            <form onSubmit={doForgotPassword} className="space-y-4">
              <h2 className="text-white text-xl text-center">Reset Password</h2>
              <input
                type="email"
                className="w-full p-3 bg-slate-800 rounded-lg text-white"
                placeholder="Email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
              />
              <button className="w-full bg-orange-600 py-3 rounded-lg text-white">
                Send Reset Email
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  try {
    console.log('Rendering main UI with:', { token: !!token, user: !!user, entities: entities?.length, geofences: geofences?.length });
    return (
      <div className="flex h-screen bg-background text-foreground">
        <Toaster position="top-right" />

        <aside className="w-80 border-r border-border overflow-hidden flex flex-col bg-secondary">
          <TrackingPanel
            entities={entities}
            onEntityAdded={() => {
              fetchEntities();
              setRouteHash('dashboard');
            }}
            onEntityDeleted={(id) => setEntities((prev) => prev.filter((e) => e.id !== id && e.entity_id !== id))}
            onEntitySelected={(entity) => mapRef.current?.flyTo([entity.lat, entity.lng], 16)}
            onAddEntityOpen={() => setIsAddEntityOpen(true)}
            onAddEntityClose={() => {
              setIsAddEntityOpen(false);
              setRouteHash('dashboard');
            }}
            onGeofenceCreated={(geofence) => setGeofences((prev) => [...prev, geofence])}
            onGeofenceView={handleGeofenceView}
            onAlertEvent={handleLiveAlertEvent}
            serverUrl={SERVER_URL}
            token={token}
            user={user}
          />
        </aside>

        <main className="flex-1 flex flex-col">
          <div className="p-4 border-b border-border bg-secondary flex justify-between items-center">
            <div className="flex items-center gap-3">
              <img src="/trackchip_logo.jpg" alt="TrackChip" className="w-9 h-9 rounded-full border border-cyan-500/40" />
              <div>
                <h1 className="text-2xl font-bold text-primary">TrackChip Dashboard</h1>
                <p className="text-sm text-gray-400">Live Tracking System</p>
              </div>
            </div>
            <div className="flex gap-3 items-center">
              <button
                onClick={() => setShowHeatmapControls(!showHeatmapControls)}
                className={`px-3 py-1 text-sm rounded font-semibold transition ${
                  showHeatmap
                    ? "bg-orange-500 text-black hover:bg-orange-600"
                    : "bg-secondary text-gray-400 hover:bg-slate-700"
                }`}
              >
                🔥 Heatmap {showHeatmap ? "ON" : "OFF"}
              </button>
              {user?.role === 'admin' && (
                <button
                  onClick={() => setRouteHash(showDocs ? 'dashboard' : 'docs')}
                  className="px-3 py-1 text-sm bg-primary text-black rounded font-semibold hover:bg-opacity-80 transition"
                >
                  {showDocs ? "📍 Map" : "📖 Docs"}
                </button>
              )}
              <button
                onClick={() => setRouteHash('devices')}
                className="px-3 py-1 text-sm bg-green-600 text-white rounded font-semibold hover:bg-green-700 transition"
              >
                📱 Devices
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="px-3 py-1 text-sm bg-gray-600 text-white rounded font-semibold hover:bg-gray-700 transition"
              >
                ⚙️ Settings
              </button>
              <div className="flex items-center space-x-3 text-right">
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <div className="w-8 h-8 bg-primary text-black rounded-full flex items-center justify-center font-bold text-sm">
                      {user?.username?.charAt(0).toUpperCase()}
                    </div>
                    {user?.role === 'admin' && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-yellow-300 text-black flex items-center justify-center text-[10px] font-bold">
                        ★
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="font-semibold">{user?.username}</p>
                    {user?.organization && (
                      <p className="text-xs text-gray-400">{user.organization}</p>
                    )}
                    <button onClick={doLogout} className="text-xs mt-1 text-red-400 hover:text-red-300">
                      Logout
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {showDocs ? (
            <div className="flex-1 overflow-y-auto">
              <TrackingSystemDoc />
            </div>
          ) : isAddEntityOpen ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="glass p-6 rounded-lg text-center max-w-md">
                <h2 className="text-xl font-bold text-primary mb-2">➕ Add Entity</h2>
                <p className="text-sm text-gray-400">The map is hidden while you add a new entity.</p>
              </div>
            </div>
          ) : isDeviceManagerOpen ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="glass p-6 rounded-lg text-center max-w-md">
                <h2 className="text-xl font-bold text-primary mb-2">📱 Device Manager</h2>
                <p className="text-sm text-gray-400">The map is hidden while you manage devices.</p>
              </div>
            </div>
          ) : (
            <>
              {showHeatmapControls && (
                <div className="border-b border-border bg-secondary p-4">
                  <div className="flex flex-col gap-4 max-w-3xl mx-auto">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-bold text-primary">🔥 Heatmap Controls</h2>
                        <p className="text-sm text-gray-400">Adjust heatmap visibility and filtering without covering the map.</p>
                      </div>
                      <button
                        onClick={() => setShowHeatmapControls(false)}
                        className="text-gray-400 hover:text-white text-2xl"
                      >
                        ×
                      </button>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-foreground">Enable Heatmap</label>
                        <button
                          onClick={() => setShowHeatmap(!showHeatmap)}
                          className={`px-3 py-2 rounded font-semibold transition ${
                            showHeatmap
                              ? "bg-green-500 text-black hover:bg-green-600"
                              : "bg-gray-600 text-white hover:bg-gray-700"
                          }`}
                        >
                          {showHeatmap ? "ON" : "OFF"}
                        </button>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-foreground">Time Range</label>
                        <select
                          value={heatmapSettings.timeRange}
                          onChange={(e) => setHeatmapSettings(prev => ({ ...prev, timeRange: e.target.value }))}
                          className="w-full bg-secondary text-foreground border border-border rounded px-3 py-2 focus:border-primary focus:outline-none"
                        >
                          <option value="1h">Last Hour</option>
                          <option value="6h">Last 6 Hours</option>
                          <option value="24h">Last 24 Hours</option>
                          <option value="7d">Last 7 Days</option>
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-foreground">Filter by Entity</label>
                        <select
                          value={heatmapSettings.entityFilter}
                          onChange={(e) => setHeatmapSettings(prev => ({ ...prev, entityFilter: e.target.value }))}
                          className="w-full bg-secondary text-foreground border border-border rounded px-3 py-2 focus:border-primary focus:outline-none"
                        >
                          <option value="all">All Entities</option>
                          {entities.map((entity) => (
                            <option key={entity.entity_id} value={entity.entity_id}>
                              {entity.label} ({entity.type})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-foreground">
                          Opacity: {Math.round(heatmapSettings.opacity * 100)}%
                        </label>
                        <input
                          type="range"
                          min="0.1"
                          max="1"
                          step="0.1"
                          value={heatmapSettings.opacity}
                          onChange={(e) => setHeatmapSettings(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="block text-sm font-semibold text-foreground">
                          Radius: {heatmapSettings.radius}px
                        </label>
                        <input
                          type="range"
                          min="5"
                          max="50"
                          step="5"
                          value={heatmapSettings.radius}
                          onChange={(e) => setHeatmapSettings(prev => ({ ...prev, radius: parseInt(e.target.value) }))}
                          className="w-full"
                        />
                      </div>

                      <div className="space-y-2 md:col-span-2">
                        <label className="block text-sm font-semibold text-foreground">
                          Blur: {heatmapSettings.blur}px
                        </label>
                        <input
                          type="range"
                          min="5"
                          max="50"
                          step="5"
                          value={heatmapSettings.blur}
                          onChange={(e) => setHeatmapSettings(prev => ({ ...prev, blur: parseInt(e.target.value) }))}
                          className="w-full"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showSettings && (
                <div className="border-b border-border bg-secondary p-4 max-h-96 overflow-y-auto">
                  <div className="flex flex-col gap-4 max-w-4xl mx-auto">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-bold text-primary">⚙️ User Settings</h2>
                        <p className="text-sm text-gray-400">Customize your TrackChip experience</p>
                      </div>
                      <button
                        onClick={() => setShowSettings(false)}
                        className="text-gray-400 hover:text-white text-2xl"
                      >
                        ×
                      </button>
                    </div>

                    {/* Settings Tabs */}
                    <div className="flex border-b border-border">
                      <button
                        onClick={() => setActiveSettingsTab('general')}
                        className={`px-4 py-2 text-sm font-medium ${
                          activeSettingsTab === 'general'
                            ? 'text-primary border-b-2 border-primary'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        General
                      </button>
                      {user?.role === 'admin' && (
                        <button
                          onClick={() => setActiveSettingsTab('activity')}
                          className={`px-4 py-2 text-sm font-medium ${
                            activeSettingsTab === 'activity'
                              ? 'text-primary border-b-2 border-primary'
                              : 'text-gray-400 hover:text-white'
                          }`}
                        >
                          Activity Logs
                        </button>
                      )}
                    </div>

                    {/* Tab Content */}
                    {activeSettingsTab === 'general' && (
                      <>
                        <div className="grid gap-4 md:grid-cols-2">
                          <div className="space-y-2">
                            <label className="block text-sm font-semibold text-foreground">Theme</label>
                            <select
                              value={userSettings.theme}
                              onChange={(e) => setUserSettings(prev => ({ ...prev, theme: e.target.value }))}
                              className="w-full bg-secondary text-foreground border border-border rounded px-3 py-2 focus:border-primary focus:outline-none"
                            >
                              <option value="dark">Dark Theme</option>
                              <option value="light">Light Theme (Coming Soon)</option>
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-sm font-semibold text-foreground">Notifications</label>
                            <div className="flex items-center space-x-2">
                              <input
                                type="checkbox"
                                checked={userSettings.soundAlerts}
                                onChange={(e) => setUserSettings(prev => ({ ...prev, soundAlerts: e.target.checked }))}
                                className="rounded"
                              />
                              <span className="text-sm text-gray-300">Enable sound alerts</span>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-sm font-semibold text-foreground">Auto-refresh</label>
                            <select
                              value={userSettings.autoRefresh}
                              onChange={(e) => setUserSettings(prev => ({ ...prev, autoRefresh: parseInt(e.target.value) }))}
                              className="w-full bg-secondary text-foreground border border-border rounded px-3 py-2 focus:border-primary focus:outline-none"
                            >
                              <option value="0">Disabled</option>
                              <option value="30">Every 30 seconds</option>
                              <option value="60">Every minute</option>
                              <option value="300">Every 5 minutes</option>
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="block text-sm font-semibold text-foreground">Map Style</label>
                            <select
                              value={userSettings.mapStyle}
                              onChange={(e) => setUserSettings(prev => ({ ...prev, mapStyle: e.target.value }))}
                              className="w-full bg-secondary text-foreground border border-border rounded px-3 py-2 focus:border-primary focus:outline-none"
                            >
                              <option value="osm">OpenStreetMap</option>
                              <option value="satellite">Satellite (Coming Soon)</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex justify-end pt-4 border-t border-border">
                          <button
                            onClick={() => saveUserSettings(userSettings)}
                            className="px-6 py-2 bg-primary text-black rounded font-semibold hover:bg-opacity-80 transition"
                          >
                            Save Changes
                          </button>
                        </div>

                        <div className="pt-4 border-t border-border">
                          <h3 className="text-md font-semibold text-primary mb-2">Account Information</h3>
                          <div className="grid gap-2 text-sm">
                            <div><span className="text-gray-400">Username:</span> {user?.username}</div>
                            <div><span className="text-gray-400">Role:</span> {user?.role}</div>
                            {user?.organization && <div><span className="text-gray-400">Organization:</span> {user.organization}</div>}
                          </div>
                        </div>
                      </>
                    )}

                    {activeSettingsTab === 'activity' && user?.role === 'admin' && (
                      <div className="max-h-96 overflow-y-auto">
                        <ActivityLogs
                          serverUrl={SERVER_URL}
                          token={token}
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex-1 relative">
                <MapContainer center={mapCenter} zoom={15} className="h-full w-full" ref={mapRef}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                  {entities.filter(e => e && (e.id || e.entity_id)).map((e) => (
                    <EntityMarker
                      key={e.id || e.entity_id}
                      entity={e}
                      onMarkerClick={(entity) => mapRef.current?.flyTo([entity.lat, entity.lng], 17)}
                    />
                  ))}

                  {geofences.filter(gf => gf && gf.id && gf.coordinates).map((gf) => (
                    <Polygon
                      key={gf.id}
                      positions={gf.coordinates}
                      pathOptions={{ color: "#00ffff", weight: 2, opacity: 0.5, fillColor: "#00ffff", fillOpacity: 0.1 }}
                    />
                  ))}

                  {Object.entries(entityHistory).filter(([id, pts]) => pts && pts.length > 0).map(([id, pts]) => (
                    <Polyline
                      key={`trail-${id}`}
                      positions={pts.map((p) => [p.lat, p.lng])}
                      pathOptions={{ color: "#00ffff", weight: 1, opacity: 0.3 }}
                    />
                  ))}
                </MapContainer>
              </div>

              <div className="border-t border-border p-4 bg-secondary overflow-y-auto max-h-32">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-bold text-primary">📋 Recent Events ({alerts.length})</h3>
              <button
                onClick={() => setShowEventPanel(!showEventPanel)}
                className="text-sm text-gray-400 hover:text-white"
                title={showEventPanel ? "Collapse to show more map" : "Expand events"}
              >
                {showEventPanel ? "▼" : "▲"}
              </button>
            </div>
            {showEventPanel && (
            <div className="space-y-2">
              {alerts.length === 0 ? (
                <div className="glass p-4 rounded text-sm text-center text-gray-400">
                  No recent events yet. Events will appear here once actions occur.
                </div>
              ) : (
                alerts.slice(0, 8).map((a, i) => (
                  <div key={i} className="glass p-2 rounded text-sm">
                    <p className="font-semibold">
                      <span className={a.event === "ENTER" ? "text-green-400" : "text-red-400"}>{a.event}</span>
                      {" → "}
                      <span className="text-primary">{a.entityName || a.label}</span>
                    </p>
                    {a.label && a.label !== a.entityName && (
                      <p className="text-xs text-gray-300">{a.label}</p>
                    )}
                    {a.entityType && (
                      <p className="text-xs text-gray-400">Type: {a.entityType}</p>
                    )}
                    {a.location && (
                      <p className="text-xs text-gray-400">Location: {a.location}</p>
                    )}
                    <p className="text-xs text-gray-500">{new Date(a.timestamp).toLocaleTimeString()}</p>
                  </div>
                ))
              )}
            </div>
            )}
          </div>
            </>
          )}
        </main>

        {/* Modals */}
        {isAddEntityOpen && (
          <AddEntity
            isOpen={isAddEntityOpen}
            onClose={() => {
              setIsAddEntityOpen(false);
              setRouteHash('dashboard');
            }}
            onEntityAdded={(entity) => {
              setEntities(prev => [...prev, entity]);
              setIsAddEntityOpen(false);
              setRouteHash('dashboard');
            }}
            serverUrl={SERVER_URL}
            token={token}
          />
        )}

        {isDeviceManagerOpen && (
          <DeviceManager
            isOpen={isDeviceManagerOpen}
            onClose={() => setRouteHash('dashboard')}
            serverUrl={SERVER_URL}
            token={token}
            entities={entities}
          />
        )}
      </div>
    );
  } catch (error) {
    console.error('App render error:', error);
    console.error('Error stack:', error.stack);
    console.error('Current state:', { token: !!token, user: !!user, entities: entities?.length, geofences: geofences?.length, dataLoading });
    // Fallback UI
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="text-center text-white">
          <h1 className="text-2xl font-bold mb-4">TrackChip</h1>
          <p className="mb-4">Application Error</p>
          <button
            onClick={() => {
              localStorage.clear();
              window.location.reload();
            }}
            className="px-4 py-2 bg-cyan-500 text-black rounded"
          >
            Reset & Reload
          </button>
        </div>
      </div>
    );
  }
}

export default App;