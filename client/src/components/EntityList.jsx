import React, { useState } from 'react';
import toast from 'react-hot-toast';

export default function EntityList({ entities, onEntityDeleted, onEntitySelected, serverUrl, token }) {
  const [loadingId, setLoadingId] = useState(null);

  const handleDelete = async (entity) => {
    if (!window.confirm(`Delete entity "${entity.label}"?`)) return;

    setLoadingId(entity.id);
    try {
      const res = await fetch(`${serverUrl}/entities/${entity.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!res.ok) {
        throw new Error('Failed to delete entity');
      }

      toast.success(`Entity "${entity.label}" deleted`);
      onEntityDeleted(entity.id);
    } catch (err) {
      console.error('Error deleting entity:', err);
      toast.error('Failed to delete entity');
    } finally {
      setLoadingId(null);
    }
  };

  const getEntityIcon = (type) => {
    switch (type) {
      case 'person':
        return '👤';
      case 'vehicle':
        return '🚗';
      case 'device':
        return '📱';
      case 'asset':
        return '📦';
      default:
        return '📍';
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case 'person':
        return 'text-blue-400';
      case 'vehicle':
        return 'text-yellow-400';
      case 'device':
        return 'text-purple-400';
      case 'asset':
        return 'text-green-400';
      default:
        return 'text-cyan-400';
    }
  };

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {entities.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          <p>No entities added yet</p>
          <p className="text-sm">Create one to start tracking</p>
        </div>
      ) : (
        entities.map(entity => (
          <div
            key={entity.id || entity.entity_id}
            onClick={() => onEntitySelected?.(entity)}
            className="glass p-3 rounded cursor-pointer hover:border-primary transition-colors group"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <span className="text-2xl">{getEntityIcon(entity.type)}</span>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{entity.label}</p>
                  <p className={`text-xs ${getTypeColor(entity.type)}`}>
                    {entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}
                  </p>
                  {entity.lat && entity.lng && (
                    <p className="text-xs text-gray-400">
                      {entity.lat.toFixed(6)}, {entity.lng.toFixed(6)}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(entity);
                }}
                disabled={loadingId === (entity.id || entity.entity_id)}
                className="text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
              >
                ✕
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
