import React, { useState, useEffect, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

// Leaflet is loaded via CDN in index.html — window.L is available globally.
// If you're using a bundled Leaflet, replace window.L with the imported L.

export default function GeofenceManager({ serverUrl, token, onGeofenceCreated, onGeofenceView }) {
  const [geofences, setGeofences] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newGeofence, setNewGeofence] = useState({ name: '', type: 'social', durationHours: 0 });
  const [drawingMode, setDrawingMode] = useState(false);
  const [tempPoints, setTempPoints] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [pendingGeofenceView, setPendingGeofenceView] = useState(null);
  const [mapReady, setMapReady] = useState(false);

  const mapRef = useRef(null);       // Leaflet map instance
  const mapDivRef = useRef(null);    // DOM node for the map
  const polygonRef = useRef(null);   // Live polygon preview layer
  const markersRef = useRef([]);     // Point markers
  const searchMarkerRef = useRef(null);

  // ─── Fetch existing geofences ────────────────────────────────────────────
  useEffect(() => {
    fetchGeofences();
  }, []);

  const fetchGeofences = async () => {
    try {
      const res = await fetch(`${serverUrl}/geofences`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setGeofences(await res.json());
    } catch (err) {
      console.error('Error fetching geofences:', err);
    }
  };

  // ─── Initialise Leaflet map when form opens ───────────────────────────────
  useEffect(() => {
    if (!showCreateForm) {
      setMapReady(false);
      // Destroy map when form closes to avoid stale instance
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        polygonRef.current = null;
        markersRef.current = [];
      }
      return;
    }

    // Small timeout so the div is rendered before Leaflet attaches
    const timer = setTimeout(() => {
      if (!mapDivRef.current || mapRef.current) return;

      const L = window.L;
      if (!L) {
        console.error('Leaflet not found. Make sure it is loaded in index.html.');
        return;
      }

      const map = L.map(mapDivRef.current, { zoomControl: true }).setView([0, 20], 3);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);

      mapRef.current = map;
      setMapReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [showCreateForm]);

  // ─── Wire / unwire click handler when drawingMode changes ─────────────────
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (drawingMode) {
      map.getContainer().style.cursor = 'crosshair';
      map.on('click', handleMapClick);
    } else {
      map.getContainer().style.cursor = '';
      map.off('click', handleMapClick);
    }

    return () => {
      map.off('click', handleMapClick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingMode]);

  // ─── Redraw polygon preview whenever tempPoints changes ───────────────────
  useEffect(() => {
    const map = mapRef.current;
    const L = window.L;
    if (!map || !L) return;

    // Remove old polygon
    if (polygonRef.current) {
      polygonRef.current.remove();
      polygonRef.current = null;
    }

    if (tempPoints.length >= 2) {
      polygonRef.current = L.polygon(tempPoints, {
        color: '#3b82f6',
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
        weight: 2,
        dashArray: tempPoints.length < 3 ? '6' : null
      }).addTo(map);
    }
  }, [tempPoints]);

  // ─── Map click handler ────────────────────────────────────────────────────
  const handleMapClick = useCallback((e) => {
    const L = window.L;
    if (!L || !mapRef.current) return;

    const { lat, lng } = e.latlng;
    const point = [lat, lng];

    // Add a small numbered marker
    const idx = markersRef.current.length + 1;
    const marker = L.marker(point, {
      icon: L.divIcon({
        className: '',
        html: `<div style="
          background:#3b82f6;color:#fff;border-radius:50%;
          width:22px;height:22px;display:flex;align-items:center;
          justify-content:center;font-size:11px;font-weight:700;
          border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">
          ${idx}
        </div>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      })
    }).addTo(mapRef.current);

    markersRef.current.push(marker);
    setTempPoints(prev => [...prev, point]);
  }, []);

  // ─── Clear all drawn points ───────────────────────────────────────────────
  const clearPoints = () => {
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    if (polygonRef.current) {
      polygonRef.current.remove();
      polygonRef.current = null;
    }
    setTempPoints([]);
  };

  const clearSearchMarker = () => {
    if (searchMarkerRef.current) {
      searchMarkerRef.current.remove();
      searchMarkerRef.current = null;
    }
  };

  const selectSearchResult = (result) => {
    const L = window.L;
    if (!L || !mapRef.current) return;

    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    mapRef.current.setView([lat, lon], 14);
    clearSearchMarker();

    searchMarkerRef.current = L.marker([lat, lon], {
      icon: L.divIcon({
        className: '',
        html: `<div style="background:#10b981;color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)">📍</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      })
    }).addTo(mapRef.current);

    setSearchQuery(result.display_name);
    setSearchResults([]);
    setSearchError('');
  };

  const flyToGeofence = useCallback((geofence) => {
    const L = window.L;
    if (!L || !geofence.coordinates?.length) return;

    if (!mapRef.current) {
      setPendingGeofenceView(geofence);
      if (!showCreateForm) {
        setShowCreateForm(true);
      }
      return;
    }

    try {
      const bounds = L.latLngBounds(geofence.coordinates);
      mapRef.current.flyToBounds(bounds, { padding: [40, 40], duration: 1.2 });
    } catch (err) {
      console.error('Error flying to geofence:', err);
    }
  }, [showCreateForm]);

  useEffect(() => {
    if (mapReady && pendingGeofenceView) {
      flyToGeofence(pendingGeofenceView);
      setPendingGeofenceView(null);
    }
  }, [mapReady, pendingGeofenceView, flyToGeofence]);

  const performLocationSearch = async () => {
    if (!searchQuery.trim()) {
      setSearchError('Enter a location to search');
      return;
    }

    setSearchLoading(true);
    setSearchError('');
    setSearchResults([]);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=6&q=${encodeURIComponent(searchQuery)}`
      );
      if (!res.ok) throw new Error('Search failed');

      const results = await res.json();
      if (!Array.isArray(results) || results.length === 0) {
        setSearchError('No locations found');
        return;
      }

      setSearchResults(results);
      selectSearchResult(results[0]);
    } catch (err) {
      console.error('Location search error:', err);
      setSearchError('Unable to find location');
    } finally {
      setSearchLoading(false);
    }
  };

  // ─── Cancel / reset form ──────────────────────────────────────────────────
  const resetForm = () => {
    clearPoints();
    clearSearchMarker();
    setDrawingMode(false);
    setNewGeofence({ name: '', type: 'social', durationHours: 0 });
    setSearchQuery('');
    setSearchResults([]);
    setSearchError('');
    setTempPoints([]);
    setShowCreateForm(false);
  };

  // ─── Submit geofence ──────────────────────────────────────────────────────
  const createGeofence = async () => {
    if (!newGeofence.name.trim()) {
      toast.error('Please enter a geofence name');
      return;
    }
    if (tempPoints.length < 3) {
      toast.error('Draw at least 3 points on the map');
      return;
    }

    try {
      const res = await fetch(`${serverUrl}/geofences`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: newGeofence.name,
          type: newGeofence.type,
          durationHours: newGeofence.durationHours > 0 ? parseInt(newGeofence.durationHours) : null,
          coordinates: tempPoints   // array of [lat, lng] pairs
        })
      });

      if (!res.ok) throw new Error('Failed to create geofence');

      const geofence = await res.json();
      setGeofences(prev => [...prev, geofence]);
      onGeofenceCreated?.(geofence);
      const duration = newGeofence.durationHours > 0 ? ` for ${newGeofence.durationHours} hours` : '';
      toast.success(`Geofence created${duration}!`);
      resetForm();
    } catch (err) {
      console.error('Error creating geofence:', err);
      toast.error('Failed to create geofence');
    }
  };

  const getTypeEmoji = (type) => ({ social: '🎉', security: '🔒', commercial: '🏢' }[type] ?? '📍');

  // ─── Delete geofence ──────────────────────────────────────────────────────
  const deleteGeofence = async (id, name) => {
    if (!window.confirm(`Delete geofence "${name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const res = await fetch(`${serverUrl}/geofences/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) throw new Error('Failed to delete geofence');

      setGeofences(prev => prev.filter(g => g.id !== id));
      toast.success(`Geofence "${name}" deleted`);
    } catch (err) {
      console.error('Error deleting geofence:', err);
      toast.error('Failed to delete geofence');
    }
  };

  const formatExpiryTime = (expiryDate) => {
    if (!expiryDate) return null;
    const now = new Date();
    const expiry = new Date(expiryDate);
    const diffMs = expiry - now;
    
    if (diffMs <= 0) return 'Expired';
    
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) return `${diffHours}h ${diffMins}m left`;
    return `${diffMins}m left`;
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="glass p-4 rounded-lg">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-primary">Geofence Management</h3>
        <button
          onClick={() => (showCreateForm ? resetForm() : setShowCreateForm(true))}
          className="btn-primary text-sm"
        >
          {showCreateForm ? 'Cancel' : '+ Create Geofence'}
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className="mb-4 p-4 bg-secondary rounded-lg space-y-3">
          <h4 className="font-semibold text-primary">Create New Geofence</h4>

          {/* Name */}
          <input
            type="text"
            placeholder="Geofence name (e.g. 'Summer Party Area')"
            className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white"
            value={newGeofence.name}
            onChange={(e) => setNewGeofence({ ...newGeofence, name: e.target.value })}
          />

          {/* Location search */}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search location to center map"
                className="flex-1 p-2 bg-slate-800 border border-slate-600 rounded text-white"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                type="button"
                onClick={performLocationSearch}
                disabled={searchLoading}
                className="px-3 py-2 bg-primary text-black rounded font-semibold hover:bg-opacity-90"
              >
                {searchLoading ? 'Searching…' : 'Search'}
              </button>
            </div>
            {searchError && <p className="text-xs text-red-300">{searchError}</p>}
            {searchResults.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded border border-slate-600 bg-slate-900 p-2">
                {searchResults.map((result) => (
                  <button
                    key={`${result.lat}-${result.lon}-${result.display_name}`}
                    type="button"
                    onClick={() => selectSearchResult(result)}
                    className="w-full text-left p-2 rounded hover:bg-slate-700"
                  >
                    <p className="text-sm text-white">{result.display_name}</p>
                    <p className="text-xs text-gray-400">{result.type}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          <p className="text-xs text-gray-400">
            You can search a location to center the map, then optionally draw the geofence manually.
          </p>

          {/* Type */}
          <select
            className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white"
            value={newGeofence.type}
            onChange={(e) => setNewGeofence({ ...newGeofence, type: e.target.value })}
          >
            <option value="social">🎉 Social Gathering</option>
            <option value="security">🔒 Security Zone</option>
            <option value="commercial">🏢 Commercial Area</option>
          </select>

          {/* Duration */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-300">Duration (Optional)</label>
            <select
              className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white"
              value={newGeofence.durationHours || 0}
              onChange={(e) => setNewGeofence({ ...newGeofence, durationHours: e.target.value ? parseInt(e.target.value) : 0 })}
            >
              <option value={0}>No expiry (permanent)</option>
              <option value={1}>1 hour</option>
              <option value={2}>2 hours</option>
              <option value={4}>4 hours</option>
              <option value={8}>8 hours</option>
              <option value={24}>1 day</option>
              <option value={72}>3 days</option>
              <option value={168}>1 week</option>
            </select>
            <p className="text-xs text-gray-500">Geofences automatically expire after the selected duration. Perfect for temporary events!</p>
          </div>

          {/* Map */}
          <div className="rounded overflow-hidden border border-slate-600" style={{ height: 280 }}>
            <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />
          </div>

          {/* Drawing controls */}
          <div className="flex gap-2 flex-wrap items-center">
            <button
              onClick={() => setDrawingMode(m => !m)}
              className={`px-3 py-1 rounded text-sm font-medium text-white ${
                drawingMode ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'
              }`}
            >
              {drawingMode ? '⏹ Stop Drawing' : '✏️ Start Drawing'}
            </button>

            {tempPoints.length > 0 && (
              <button
                onClick={clearPoints}
                className="px-3 py-1 rounded text-sm font-medium bg-orange-500 hover:bg-orange-600 text-white"
              >
                Clear ({tempPoints.length} pts)
              </button>
            )}

            <span className="text-xs text-gray-400 ml-auto">
              {drawingMode
                ? tempPoints.length === 0
                  ? 'Click the map to add points'
                  : `${tempPoints.length} point${tempPoints.length !== 1 ? 's' : ''} — need at least 3`
                : tempPoints.length > 0
                ? `${tempPoints.length} points plotted`
                : 'Press Start Drawing, then click the map'}
            </span>
          </div>

          {/* Submit */}
          <button
            onClick={createGeofence}
            disabled={tempPoints.length < 3 || !newGeofence.name.trim()}
            className="w-full btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {tempPoints.length < 3
              ? `Draw ${3 - tempPoints.length} more point${3 - tempPoints.length !== 1 ? 's' : ''} to continue`
              : 'Create Geofence'}
          </button>
        </div>
      )}

      {/* Existing geofences */}
      <div className="space-y-2">
        <p className="text-sm text-gray-400">Active Geofences:</p>
        {geofences.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No geofences created yet</p>
        ) : (
          geofences.map(geofence => (
            <div
              key={geofence.id}
              className="p-3 rounded bg-secondary border border-border hover:bg-slate-800 transition"
            >
              <div className="flex items-start gap-3">
                <span className="text-lg">{getTypeEmoji(geofence.type)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-primary">{geofence.name}</p>
                  <p className="text-xs text-gray-400 capitalize">
                    {geofence.type} Zone · {geofence.coordinates?.length ?? 0} points
                  </p>
                  {geofence.expiry_date && (
                    <p className={`text-xs font-semibold mt-1 ${
                      formatExpiryTime(geofence.expiry_date)?.includes('Expired')
                        ? 'text-red-400'
                        : 'text-orange-400'
                    }`}>
                      ⏰ {formatExpiryTime(geofence.expiry_date)}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => flyToGeofence(geofence)}
                    title="View on map"
                    className="px-2 py-1 text-xs bg-primary text-black rounded font-semibold hover:bg-opacity-90 transition"
                  >
                    View
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteGeofence(geofence.id, geofence.name)}
                    title="Delete this geofence"
                    className="px-2 py-1 text-xs bg-red-600 text-white rounded font-semibold hover:bg-red-700 transition"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Info box */}
      <div className="mt-4 p-3 bg-blue-900/20 rounded-lg">
        <h4 className="font-semibold text-blue-400 mb-2">📍 How Geofences Work</h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• Create boundaries for social gatherings, security zones, or commercial areas</li>
          <li>• System automatically detects when entities enter/exit geofences</li>
          <li>• Generates alerts for unauthorized movements</li>
          <li>• Perfect for event management and security monitoring</li>
        </ul>
      </div>
    </div>
  );
}