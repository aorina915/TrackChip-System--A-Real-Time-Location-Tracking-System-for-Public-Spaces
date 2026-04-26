import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

const playTone = (type) => {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    const fallback = new Audio('/alert.mp3');
    fallback.volume = 0.6;
    fallback.play().catch(() => {});
    return;
  }

  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const pitchMap = {
      report: 660,
      resolved: 900,
      dismissed: 320,
    };
    const waveform = type === 'resolved' ? 'triangle' : type === 'dismissed' ? 'square' : 'sine';
    const duration = 0.9;

    osc.type = waveform;
    osc.frequency.value = pitchMap[type] || 660;
    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.24, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
    osc.onended = () => ctx.close();
  } catch (err) {
    console.error('Audio playback failed', err);
    const fallback = new Audio('/alert.mp3');
    fallback.volume = 0.6;
    fallback.play().catch(() => {});
  }
};

export default function AlertsManager({ serverUrl, token, entities, onAlertEvent }) {
  const [alerts, setAlerts] = useState([]);
  const [showReportForm, setShowReportForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reportData, setReportData] = useState({
    entityId: '',
    issue_type: 'stolen',
    description: ''
  });

  useEffect(() => {
    fetchAlerts();
  }, []);

  // GET /alerts — dedicated alerts table
  const fetchAlerts = async () => {
    try {
      const res = await fetch(`${serverUrl}/alerts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setAlerts(await res.json());
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  // POST /entities/:id/report — uses numeric DB id from the dropdown
  const reportEntityIssue = async () => {
    if (!reportData.entityId || !reportData.description.trim()) {
      toast.error('Please select an entity and provide a description');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(
        `${serverUrl}/entities/${reportData.entityId}/report`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            issue_type: reportData.issue_type,
            description: reportData.description
          })
        }
      );

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || `HTTP ${res.status}`);
      }

      playTone('report');
      toast.success('Issue reported successfully!');
      const entity = entities.find((e) => String(e.id) === String(reportData.entityId));
      const liveEvent = {
        entityId: reportData.entityId,
        label: `Reported: ${reportData.issue_type.toUpperCase()}`,
        event: 'REPORTED',
        issue_type: reportData.issue_type,
        description: reportData.description,
        timestamp: new Date().toISOString(),
        entityType: entity?.type,
        location: entity?.lat != null && entity?.lng != null ? `${entity.lat.toFixed(5)}, ${entity.lng.toFixed(5)}` : undefined,
      };
      onAlertEvent?.(liveEvent);
      setReportData({ entityId: '', issue_type: 'stolen', description: '' });
      setShowReportForm(false);
      fetchAlerts();
    } catch (err) {
      console.error('Error reporting issue:', err);
      toast.error(`Failed to submit report: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  // PUT /alerts/:id/status — values: resolved | dismissed
  const updateAlertStatus = async (alertId, status) => {
    try {
      const res = await fetch(`${serverUrl}/alerts/${alertId}/status`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      });

      if (!res.ok) throw new Error('Failed to update alert status');

      setAlerts(prev =>
        prev.map(a => a.id === alertId ? { ...a, status } : a)
      );
      playTone(status);
      toast.success(`Alert marked as ${status}`);
      const alert = alerts.find((a) => a.id === alertId);
      const entity = entities.find((e) => String(e.id) === String(alert?.entity_id) || String(e.entity_id) === String(alert?.entity_id));
      const liveEvent = {
        entityId: alert?.entity_id || alert?.entityId,
        label: `${status.toUpperCase()}: ${alert?.issue_type ? alert.issue_type.toUpperCase() : 'Alert'}`,
        event: status.toUpperCase(),
        status,
        issue_type: alert?.issue_type,
        timestamp: new Date().toISOString(),
        entityType: entity?.type,
        location: entity?.lat != null && entity?.lng != null ? `${entity.lat.toFixed(5)}, ${entity.lng.toFixed(5)}` : undefined,
      };
      onAlertEvent?.(liveEvent);
    } catch (err) {
      console.error('Error updating alert status:', err);
      toast.error('Failed to update alert status');
    }
  };

  const getAlertIcon = (type) =>
    ({ stolen: '🚨', damaged: '🔧', lost: '❓', suspicious: '👀', ENTER: '➡️', EXIT: '⬅️' }[type] ?? '📢');

  const getStatusColor = (status) =>
    ({ resolved: 'text-green-400', dismissed: 'text-red-400' }[status] ?? 'text-yellow-400');

  const pendingAlerts = alerts.filter(a => a.status === 'pending');

  return (
    <div className="glass p-4 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-primary">Alert Management</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setShowReportForm(!showReportForm)}
            className="btn-primary text-sm"
          >
            {showReportForm ? 'Cancel' : '🚨 Report Issue'}
          </button>
          <button
            onClick={fetchAlerts}
            className="px-3 py-1 bg-secondary text-gray-300 rounded text-sm hover:bg-slate-700"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {showReportForm && (
        <div className="mb-4 p-4 bg-red-900/20 rounded-lg border border-red-500/20 space-y-3">
          <h4 className="font-semibold text-red-400">Report Entity Issue</h4>

          <select
            className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white"
            value={reportData.entityId}
            onChange={(e) => setReportData({ ...reportData, entityId: e.target.value })}
          >
            <option value="">Select Entity</option>
            {entities.map(entity => (
              <option key={entity.id} value={entity.id}>
                {entity.label} ({entity.type})
              </option>
            ))}
          </select>

          <select
            className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white"
            value={reportData.issue_type}
            onChange={(e) => setReportData({ ...reportData, issue_type: e.target.value })}
          >
            <option value="stolen">🚨 Stolen</option>
            <option value="damaged">🔧 Damaged</option>
            <option value="lost">❓ Lost</option>
            <option value="suspicious">👀 Suspicious Activity</option>
          </select>

          <textarea
            placeholder="Describe the issue in detail..."
            className="w-full p-2 bg-slate-800 border border-slate-600 rounded text-white h-20 resize-none"
            value={reportData.description}
            onChange={(e) => setReportData({ ...reportData, description: e.target.value })}
          />

          <button
            onClick={reportEntityIssue}
            disabled={submitting || !reportData.entityId || !reportData.description.trim()}
            className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 px-4 rounded"
          >
            {submitting ? 'Submitting…' : 'Submit Report'}
          </button>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <p className="text-sm text-gray-400">Recent Alerts:</p>
          {pendingAlerts.length > 0 && (
            <span className="text-xs bg-red-500 text-white px-2 py-1 rounded">
              {pendingAlerts.length} pending
            </span>
          )}
        </div>

        {alerts.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No alerts yet</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {alerts.slice(0, 20).map(alert => (
              <div
                key={alert.id}
                className={`p-3 rounded border ${
                  alert.status === 'pending'
                    ? 'bg-yellow-900/20 border-yellow-500/20'
                    : 'bg-secondary border-border'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg">{getAlertIcon(alert.issue_type || alert.event)}</span>
                      <p className="font-medium text-primary capitalize">
                        {alert.issue_type ?? alert.event}
                      </p>
                      <span className={`text-xs px-2 py-1 rounded ${getStatusColor(alert.status)}`}>
                        {alert.status}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(alert.created_at || alert.timestamp).toLocaleString()}
                    </p>
                    {alert.entity_id && (
                      <p className="text-xs text-cyan-400">
                        Entity:{' '}
                        {entities.find(
                          e => String(e.id) === String(alert.entity_id) ||
                               e.entity_id === alert.entity_id
                        )?.label ?? alert.entity_id}
                      </p>
                    )}
                    {alert.description && (
                      <p className="text-xs text-gray-300 mt-1 italic">"{alert.description}"</p>
                    )}
                  </div>

                  {alert.status === 'pending' && (
                    <div className="flex gap-1 ml-2 shrink-0">
                      <button
                        onClick={() => updateAlertStatus(alert.id, 'resolved')}
                        className="px-2 py-1 bg-green-600 hover:bg-green-700 text-white text-xs rounded"
                        title="Mark as resolved"
                      >✓</button>
                      <button
                        onClick={() => updateAlertStatus(alert.id, 'dismissed')}
                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                        title="Dismiss"
                      >✕</button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 p-3 bg-orange-900/20 rounded-lg">
        <h4 className="font-semibold text-orange-400 mb-2">🚨 Alert System</h4>
        <ul className="text-xs text-gray-400 space-y-1">
          <li>• Automatic geofence entry/exit alerts</li>
          <li>• Manual entity issue reporting (stolen, damaged, lost)</li>
          <li>• Real-time notifications to all connected users</li>
          <li>• Track alert status: pending → resolved / dismissed</li>
        </ul>
      </div>
    </div>
  );
}