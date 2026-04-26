import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function ActivityLogs({ serverUrl, token }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const fetchLogs = async (currentOffset = 0) => {
    try {
      const res = await fetch(`${serverUrl}/activity-logs?limit=20&offset=${currentOffset}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) throw new Error('Failed to fetch activity logs');

      const data = await res.json();
      if (currentOffset === 0) {
        setLogs(data);
      } else {
        setLogs(prev => [...prev, ...data]);
      }
      setHasMore(data.length === 20);
    } catch (err) {
      console.error('Error fetching activity logs:', err);
      toast.error('Failed to load activity logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const loadMore = () => {
    const newOffset = offset + 20;
    setOffset(newOffset);
    fetchLogs(newOffset);
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'LOGIN': return '🔐';
      case 'CREATE': return '➕';
      case 'UPDATE': return '✏️';
      case 'DELETE': return '🗑️';
      default: return '📝';
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'LOGIN': return 'text-green-400';
      case 'CREATE': return 'text-blue-400';
      case 'UPDATE': return 'text-yellow-400';
      case 'DELETE': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  if (loading && logs.length === 0) {
    return (
      <div className="glass p-6 rounded-lg">
        <h2 className="text-2xl font-bold text-primary mb-4">📊 Activity Logs</h2>
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="ml-3 text-gray-400">Loading activity logs...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-6 rounded-lg">
      <h2 className="text-2xl font-bold text-primary mb-4">📊 Activity Logs</h2>
      <p className="text-gray-400 mb-6">Recent user activities and system events</p>

      {logs.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 italic">No activity logs available</p>
          <p className="text-sm text-gray-600 mt-2">Activity logs will appear here as users interact with the system</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map(log => (
            <div key={log.id} className="border border-border rounded-lg p-4 bg-secondary bg-opacity-50">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getActionIcon(log.action)}</span>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`font-semibold ${getActionColor(log.action)}`}>
                      {log.action}
                    </span>
                    <span className="text-gray-400">•</span>
                    <span className="text-sm text-gray-400">{log.resource_type}</span>
                    {log.username && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="text-sm text-cyan-400">{log.username}</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-gray-300 mb-2">
                    {log.details && Object.keys(log.details).length > 0
                      ? JSON.stringify(log.details)
                      : 'No additional details'
                    }
                  </p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{formatTimestamp(log.created_at)}</span>
                    {log.ip_address && <span>IP: {log.ip_address}</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="text-center pt-4">
              <button
                onClick={loadMore}
                className="px-4 py-2 bg-primary text-black rounded font-semibold hover:bg-opacity-80 transition"
              >
                Load More
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}