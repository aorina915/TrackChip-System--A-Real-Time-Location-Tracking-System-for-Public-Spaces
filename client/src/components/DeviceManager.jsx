import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function DeviceManager({ isOpen, onClose, serverUrl, token, entities }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [linkingEntity, setLinkingEntity] = useState(null);

  // Fetch user's devices
  useEffect(() => {
    if (isOpen && token) {
      fetchDevices();
    }
  }, [isOpen, token]);

  const fetchDevices = async () => {
    try {
      const res = await fetch(`${serverUrl}/devices`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setDevices(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
    }
  };

  const handleRegisterDevice = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${serverUrl}/devices/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to register device');
      }

      const newDevice = await res.json();
      setDevices(prev => [newDevice, ...prev]);
      toast.success(`📱 Device "${newDevice.device_name}" registered successfully!`);
    } catch (err) {
      console.error('Device registration error:', err);
      toast.error('Failed to register device');
    } finally {
      setLoading(false);
    }
  };

  const handleLinkDevice = async (deviceId, entityId) => {
    setLinkingEntity(deviceId);
    try {
      const res = await fetch(`${serverUrl}/devices/${deviceId}/link-entity`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ entityId })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to link device');
      }

      toast.success('🔗 Device linked to entity successfully!');
      fetchDevices(); // Refresh device list
    } catch (err) {
      console.error('Device linking error:', err);
      toast.error('Failed to link device to entity');
    } finally {
      setLinkingEntity(null);
    }
  };

  const handleDeleteDevice = async (deviceId, deviceName) => {
    if (!confirm(`Are you sure you want to delete device "${deviceName}"? This will unlink it from any entities.`)) {
      return;
    }

    try {
      const res = await fetch(`${serverUrl}/devices/${deviceId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error('Failed to delete device');
      }

      setDevices(prev => prev.filter(d => d.device_id !== deviceId));
      toast.success('🗑️ Device deleted successfully');
    } catch (err) {
      console.error('Device deletion error:', err);
      toast.error('Failed to delete device');
    }
  };

  const getLinkedEntity = (deviceId) => {
    return entities.find(e => e.device_id === deviceId);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="glass p-8 rounded-lg w-full max-w-4xl h-5/6 flex flex-col">
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <h2 className="text-2xl font-bold text-primary">📱 Device Management</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>

        {/* Register Current Device */}
        <div className="mb-6 p-4 bg-secondary rounded-lg flex-shrink-0">
          <h3 className="text-lg font-semibold text-primary mb-3">🔍 Register Current Device</h3>
          <p className="text-sm text-gray-400 mb-4">
            Automatically detect and register the device you're currently using to access the system.
          </p>
          <button
            onClick={handleRegisterDevice}
            disabled={loading}
            className="px-4 py-2 bg-primary text-black rounded font-semibold hover:bg-opacity-80 disabled:opacity-50"
          >
            {loading ? '🔄 Registering...' : '📱 Register This Device'}
          </button>
        </div>

        {/* Device List - Scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="space-y-4 pr-2">
            <h3 className="text-lg font-semibold text-primary">📋 Your Registered Devices</h3>
            
            {devices.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>No devices registered yet.</p>
                <p className="text-sm">Click "Register This Device" to get started.</p>
              </div>
            ) : (
              devices.map((device) => {
                const linkedEntity = getLinkedEntity(device.device_id);
                
                return (
                  <div key={device.device_id} className="glass p-4 rounded-lg">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h4 className="font-semibold text-primary">{device.device_name}</h4>
                        <p className="text-sm text-gray-400">
                          Type: {device.device_type} • 
                          Last seen: {new Date(device.last_seen).toLocaleString()}
                        </p>
                        {linkedEntity && (
                          <p className="text-sm text-green-400">
                            🔗 Linked to: {linkedEntity.label} ({linkedEntity.type})
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteDevice(device.device_id, device.device_name)}
                        className="text-red-400 hover:text-red-300 text-sm"
                      >
                        🗑️ Delete
                      </button>
                    </div>

                    {/* Link to Entity */}
                    <div className="border-t border-border pt-3">
                      <label className="block text-sm font-semibold mb-2 text-foreground">
                        🔗 Link to Entity (Optional)
                      </label>
                      <div className="flex gap-2">
                        <select
                          className="flex-1 bg-secondary text-foreground border border-border rounded px-3 py-2 text-sm focus:border-primary focus:outline-none"
                          defaultValue=""
                          disabled={linkingEntity === device.device_id}
                        >
                          <option value="">Select entity to link...</option>
                          {entities.map((entity) => (
                            <option key={entity.entity_id} value={entity.entity_id}>
                              {entity.label} ({entity.type})
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={(e) => {
                            const select = e.target.previousElementSibling;
                            const entityId = select.value;
                            if (entityId) {
                              handleLinkDevice(device.device_id, entityId);
                            }
                          }}
                          disabled={linkingEntity === device.device_id}
                          className="px-3 py-2 bg-primary text-black text-sm rounded font-semibold hover:bg-opacity-80 disabled:opacity-50"
                        >
                          {linkingEntity === device.device_id ? '🔄 Linking...' : '🔗 Link'}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Link this device to track location data from it automatically
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Info - Fixed at bottom */}
        <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/40 rounded-lg flex-shrink-0">
          <h4 className="font-semibold text-blue-400 mb-2">ℹ️ Multi-Device Support</h4>
          <p className="text-sm text-gray-300">
            You can register multiple devices and access your account from any of them simultaneously.
            Each device can be linked to different entities for automatic location tracking.
          </p>
        </div>
      </div>
    </div>
  );
}