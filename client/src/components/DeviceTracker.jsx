import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

export default function DeviceTracker({ serverUrl, token, onDeviceRegistered }) {
  const [devices, setDevices] = useState([]);
  const [currentDevice, setCurrentDevice] = useState(null);
  const [loading, setLoading] = useState(false);

  // Generate a unique device ID
  const generateDeviceId = () => {
    if (typeof window !== 'undefined') {
      const storedId = localStorage.getItem('device_id');
      if (storedId) return storedId;

      const newId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('device_id', newId);
      return newId;
    }
    return `device_${Date.now()}`;
  };

  useEffect(() => {
    if (!token) return;

    // Fetch existing devices
    fetch(`${serverUrl}/devices`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => setDevices(Array.isArray(data) ? data : []))
      .catch(err => console.error('Error fetching devices:', err));
  }, [token, serverUrl]);

  const registerCurrentDevice = async () => {
    setLoading(true);
    const deviceId = generateDeviceId();
    const deviceName = `${navigator.userAgent.split('/').pop().substring(0, 30)} - ${new Date().toLocaleDateString()}`;

    try {
      const res = await fetch(`${serverUrl}/devices/register`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          device_id: deviceId,
          device_name: deviceName,
          device_type: 'mobile'
        })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ message: 'Unknown error' }));
        throw new Error(`Failed to register device: ${errorData.message || res.status}`);
      }

      const device = await res.json();
      setCurrentDevice(device);
      setDevices(prev => [device, ...prev.filter(d => d.device_id !== deviceId)]);
      localStorage.setItem('current_device_id', deviceId);
      
      toast.success('Device registered for tracking!');
      onDeviceRegistered?.(device);
    } catch (err) {
      console.error('Error registering device:', err);
      toast.error(err.message || 'Failed to register device');
    } finally {
      setLoading(false);
    }
  };

  const getDeviceType = (device) => {
    const ua = device.device_name || '';
    if (ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone')) return 'Mobile';
    if (ua.includes('Tablet') || ua.includes('iPad')) return 'Tablet';
    return 'Computer';
  };

  return (
    <div className="glass p-4 rounded-lg">
      <h3 className="text-lg font-semibold text-primary mb-4">Device Tracking</h3>
      
      <div className="space-y-3">
        {devices.length > 0 && (
          <div>
            <p className="text-sm text-gray-400 mb-2">Registered Devices:</p>
            <div className="space-y-2">
              {devices.map(device => (
                <div
                  key={device.device_id || device.id}
                  className={`p-2 rounded text-sm ${
                    currentDevice?.device_id === device.device_id
                      ? 'bg-primary bg-opacity-20 border border-primary'
                      : 'bg-secondary border border-border'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-lg">
                      {getDeviceType(device) === 'Mobile' ? '📱' : '💻'}
                    </span>
                    <div className="flex-1">
                      <p className="font-medium">{device.device_name?.substring(0, 40)}</p>
                      <p className="text-xs text-gray-400">
                        {getDeviceType(device)} • {device.is_active ? 'Active' : 'Inactive'}
                      </p>
                    </div>
                    {currentDevice?.device_id === device.device_id && (
                      <span className="text-xs bg-primary text-black px-2 py-1 rounded">
                        Current
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={registerCurrentDevice}
          disabled={loading}
          className="w-full btn-primary text-sm disabled:opacity-50"
        >
          {loading ? 'Registering...' : `${devices.length > 0 ? 'Register Another' : 'Register This'} Device`}
        </button>
      </div>

      <p className="text-xs text-gray-400 mt-4">
        📌 <strong>What does "Device Linked" mean?</strong><br />
        When you link a device to an entity, that entity will automatically track the device's GPS location in real-time. 
        The device becomes a "smart tracker" that reports its position every few seconds, allowing you to monitor 
        people, vehicles, or assets carrying the device. This is perfect for tracking your phone, a family member's 
        device, or GPS-enabled equipment.
      </p>
    </div>
  );
}
