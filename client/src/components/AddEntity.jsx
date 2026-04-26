import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function AddEntity({ isOpen, onClose, onEntityAdded, serverUrl, token }) {
  const [formData, setFormData] = useState({
    entity_type: 'device',
    label: '',
    lat: -1.286389,
    lng: 36.817223,
    device_id: ''
  });
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [devices, setDevices] = useState([]);
  const [subscription, setSubscription] = useState(null);

  // Fetch user's devices and subscription
  useEffect(() => {
    if (isOpen && token) {
      const apiHeaders = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
      
      fetch(`${serverUrl}/devices`, {
        headers: apiHeaders
      })
        .then(res => res.json())
        .then(data => setDevices(Array.isArray(data) ? data : []))
        .catch(err => console.error('Error fetching devices:', err));

      fetch(`${serverUrl}/subscription`, {
        headers: apiHeaders
      })
        .then(res => res.json())
        .then(data => setSubscription(data))
        .catch(err => console.error('Error fetching subscription:', err));
    }
  }, [isOpen, token, serverUrl]);

  // Auto-detect user location on component mount or when modal opens
  useEffect(() => {
    if (isOpen && navigator.geolocation) {
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setFormData(prev => ({
            ...prev,
            lat: parseFloat(latitude.toFixed(6)),
            lng: parseFloat(longitude.toFixed(6))
          }));
          setLocating(false);
          toast.success('📍 Location detected automatically');
        },
        (error) => {
          console.log('Geolocation error:', error);
          setLocating(false);
          // Keep default location if geolocation fails
        }
      );
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'lat' || name === 'lng' ? parseFloat(value) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.label.trim()) {
      toast.error('Entity label is required');
      return;
    }

    setLoading(true);
    try {
      const apiHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      const res = await fetch(`${serverUrl}/entities`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify(formData)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        
        if (res.status === 403 && errorData.upgradeRequired) {
          toast.error(`🚫 ${errorData.error}`, {
            duration: 6000,
            action: {
              label: 'Upgrade to Premium',
              onClick: () => handleUpgrade()
            }
          });
          return;
        }
        
        throw new Error(errorData.error || `Failed to create entity: ${res.status}`);
      }

      const newEntity = await res.json();
      toast.success(`Entity "${formData.label}" added successfully`);
      
      setFormData({
        entity_type: 'person',
        label: '',
        lat: -1.286389,
        lng: 36.817223,
        device_id: ''
      });
      
      onEntityAdded();
      onClose();
    } catch (err) {
      console.error('Error creating entity:', err);
      toast.error('Failed to create entity');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async () => {
    const upgradeToast = toast.loading('🔄 Initializing payment...');
    try {
      // Create Stripe checkout session
      const apiHeaders = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };
      const res = await fetch(`${serverUrl}/payment/create-session`, {
        method: 'POST',
        headers: apiHeaders,
        body: JSON.stringify({ plan: 'premium' })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
        console.error('Payment error response:', res.status, errorData);
        toast.error(`❌ ${errorData.error || 'Failed to create payment session'}`, { id: upgradeToast });
        return;
      }

      const sessionData = await res.json();
      
      if (!sessionData || !sessionData.url) {
        console.error('Invalid session data:', sessionData);
        toast.error('❌ Payment session data is incomplete', { id: upgradeToast });
        return;
      }

      toast.dismiss(upgradeToast);
      toast.success('💳 Redirecting to payment...', { duration: 2 });
      
      // Redirect to Stripe Checkout
      setTimeout(() => {
        window.location.href = sessionData.url;
      }, 500);
    } catch (err) {
      console.error('Payment session creation error:', err);
      toast.error(`❌ ${err.message || 'Failed to start payment process. Please try again.'}`, { id: upgradeToast });
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="glass p-8 rounded-lg w-full max-w-2xl h-[90vh] overflow-y-auto">
        <h2 className="text-2xl font-bold text-primary mb-6">➕ Add New Entity to Track</h2>
        
        {/* Subscription Status */}
        {subscription && (
          <div className={`p-3 rounded-lg mb-4 ${
            subscription.plan === 'free' && subscription.current_count >= subscription.entity_limit
              ? 'bg-red-900/20 border border-red-500/40'
              : 'bg-green-900/20 border border-green-500/40'
          }`}>
            <div className="flex justify-between items-center">
              <div>
                <p className="font-semibold text-sm">
                  {subscription.plan === 'free' ? '🆓 Free Plan' : '💎 Premium Plan'}
                </p>
                <p className="text-xs text-gray-400">
                  {subscription.current_count} / {subscription.entity_limit === 999999 ? '∞' : subscription.entity_limit} entities
                </p>
              </div>
              {subscription.plan === 'free' && subscription.current_count >= subscription.entity_limit && (
                <button
                  onClick={handleUpgrade}
                  className="px-3 py-1 bg-primary text-black text-xs rounded font-semibold hover:bg-opacity-80"
                >
                  Upgrade
                </button>
              )}
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Entity Label */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-foreground">Entity Label *</label>
            <input
              type="text"
              name="label"
              value={formData.label}
              onChange={handleChange}
              placeholder="e.g., Student A, Shuttle 1, Delivery Bag"
              className="w-full bg-secondary text-foreground border border-border rounded px-4 py-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
            />
            <p className="text-xs text-gray-400 mt-1">Give this entity a recognizable name</p>
          </div>

          {/* Entity Type */}
          <div>
            <label className="block text-sm font-semibold mb-2 text-foreground">Entity Type *</label>
            <select
              name="entity_type"
              value={formData.entity_type}
              onChange={handleChange}
              className="w-full bg-secondary text-foreground border border-border rounded px-4 py-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
            >
              <option value="device">📱 Device (Phone, Watch, GPS Unit)</option>
              <option value="person">👤 Person</option>
              <option value="vehicle">🚗 Vehicle (Car, Truck, Van)</option>
              <option value="asset">📦 Asset (Package, Cargo, Equipment)</option>
              <option value="other">❓ Other</option>
            </select>
            <p className="text-xs text-gray-400 mt-1">Select what you're tracking</p>
          </div>

          {/* Device Linking (Optional) */}
          {devices.length > 0 && (
            <div>
              <label className="block text-sm font-semibold mb-2 text-foreground">🔗 Link to Device (Optional)</label>
              <select
                name="device_id"
                value={formData.device_id}
                onChange={handleChange}
                className="w-full bg-secondary text-foreground border border-border rounded px-4 py-3 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary transition"
              >
                <option value="">No device linked (manual tracking)</option>
                {devices.map(device => (
                  <option key={device.device_id} value={device.device_id}>
                    📱 {device.device_name} ({device.device_type})
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-400 mt-1">
                Link this entity to a registered device for automatic GPS tracking
              </p>
            </div>
          )}
          <div className="border border-border rounded-lg p-4 bg-opacity-30">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-sm font-semibold text-primary">📍 Current Location</h3>
              {locating && <span className="text-xs text-yellow-400">Detecting...</span>}
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-2 text-foreground">Latitude</label>
                <input
                  type="number"
                  step="0.000001"
                  name="lat"
                  value={formData.lat}
                  onChange={handleChange}
                  disabled={locating}
                  className="w-full bg-secondary text-foreground border border-border rounded px-3 py-2 focus:border-primary focus:outline-none text-sm disabled:opacity-50"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-2 text-foreground">Longitude</label>
                <input
                  type="number"
                  step="0.000001"
                  name="lng"
                  value={formData.lng}
                  onChange={handleChange}
                  disabled={locating}
                  className="w-full bg-secondary text-foreground border border-border rounded px-3 py-2 focus:border-primary focus:outline-none text-sm disabled:opacity-50"
                />
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              {locating ? '🔄 Getting your location...' : '✅ Location auto-detected from your device'}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              type="submit"
              disabled={loading || locating || !formData.label.trim()}
              className="flex-1 btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '⏳ Adding...' : '✅ Add Entity'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
