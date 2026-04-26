import React, { useState } from 'react';
import toast from 'react-hot-toast';
import AddEntity from './AddEntity';
import EntityList from './EntityList';
import DeviceTracker from './DeviceTracker';
import GeofenceManager from './GeofenceManager';
import AlertsManager from './AlertsManager';

export default function TrackingPanel({
  entities = [],
  onEntityAdded,
  onEntityDeleted,
  onEntitySelected,
  onAddEntityOpen,
  onAddEntityClose,
  onGeofenceCreated,
  onGeofenceView,
  onAlertEvent,
  serverUrl,
  token,
  user
}) {
  const [showAddEntity, setShowAddEntity] = useState(false);

  const activeEntities = entities.filter(e => e.is_active !== false);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <h2 className="text-2xl font-bold text-primary mb-2">🗺️ Live Tracking</h2>
        <p className="text-sm text-gray-400">
          {activeEntities.length} Active Entities
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Device Tracker */}
        <DeviceTracker
          serverUrl={serverUrl}
          token={token}
          onDeviceRegistered={() => {
            // Device registered successfully - could refresh device list or show success
            console.log('Device registered successfully');
          }}
        />

        {/* Geofence Manager */}
        <GeofenceManager
          serverUrl={serverUrl}
          token={token}
          onGeofenceCreated={onGeofenceCreated}
          onGeofenceView={onGeofenceView}
        />

        {/* Alerts Manager */}
        <AlertsManager
          serverUrl={serverUrl}
          token={token}
          entities={entities}
          onAlertEvent={onAlertEvent}
        />

        {/* Entities Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="glass p-3 rounded text-center">
            <p className="text-2xl font-bold text-primary">{activeEntities.length}</p>
            <p className="text-xs text-gray-400">Tracked Entities</p>
          </div>
          <div className="glass p-3 rounded text-center">
            <p className="text-2xl font-bold text-green-400">
              {entities.filter(e => e.device_id).length}
            </p>
            <p className="text-xs text-gray-400">Device Linked</p>
          </div>
        </div>

        {/* Demo Entities Button */}
        <div className="glass p-3 rounded">
          <button
            onClick={async () => {
              try {
                const res = await fetch(`${serverUrl}/demo/entities`, {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                  toast.success('Demo entities loaded successfully!');
                } else {
                  toast.error('Failed to load demo entities');
                }
              } catch (err) {
                console.error('Demo entities error:', err);
                toast.error('Failed to load demo entities');
              }
            }}
            className="w-full btn-secondary text-sm"
          >
            🎭 Load Demo Entities
          </button>
          <p className="text-xs text-gray-400 mt-2 text-center">
            Add sample entities to showcase the system
          </p>
        </div>

        {/* Entity List */}
        <EntityList
          entities={activeEntities}
          onEntityDeleted={onEntityDeleted}
          onEntitySelected={onEntitySelected}
          serverUrl={serverUrl}
          token={token}
        />
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border">
        <button
          onClick={() => {
            setShowAddEntity(true);
            onAddEntityOpen?.();
          }}
          className="w-full btn-primary"
        >
          + Add New Entity
        </button>
      </div>

      {/* Add Entity Modal */}
      <AddEntity
        isOpen={showAddEntity}
        onClose={() => {
          setShowAddEntity(false);
          onAddEntityClose?.();
        }}
        onEntityAdded={() => {
          onEntityAdded();
        }}
        serverUrl={serverUrl}
        token={token}
      />
    </div>
  );
}
