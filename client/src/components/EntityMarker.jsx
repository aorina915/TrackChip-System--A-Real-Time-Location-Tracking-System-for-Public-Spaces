import React from 'react';
import { Marker, Popup, Tooltip } from 'react-leaflet';
import L from 'leaflet';

// Create a custom div icon for entities
const createEntityIcon = (type, color = '#00ffff') => {
  const iconHtml = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      background: rgba(0, 255, 255, 0.1);
      border: 2px solid ${color};
      border-radius: 50%;
      box-shadow: 0 0 15px ${color};
      font-size: 18px;
    ">
      ${
        type === 'person'
          ? '👤'
          : type === 'vehicle'
          ? '🚗'
          : type === 'device'
          ? '📱'
          : type === 'asset'
          ? '📦'
          : '📍'
      }
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    iconSize: [32, 32],
    className: 'entity-marker',
  });
};

export default function EntityMarker({
  entity,
  onMarkerClick,
  isFollowing = false,
}) {
  const color = isFollowing ? '#ff00ff' : '#00ffff';

  return (
    <Marker
      position={[entity.lat, entity.lng]}
      icon={createEntityIcon(entity.type, color)}
      eventHandlers={{
        click: () => onMarkerClick?.(entity),
      }}
    >
      <Tooltip sticky permanent={false}>
        <div className="text-sm">
          <p className="font-bold">{entity.label}</p>
          <p className="text-xs">{entity.type}</p>
        </div>
      </Tooltip>
      <Popup closeButton={true}>
        <div className="p-2 min-w-[200px]">
          <p className="font-bold text-primary mb-1">{entity.label}</p>
          <div className="text-sm space-y-1 text-gray-600">
            <p>
              <strong>Type:</strong> {entity.type.charAt(0).toUpperCase() + entity.type.slice(1)}
            </p>
            <p>
              <strong>Location:</strong>
              <br />
              Lat: {entity.lat.toFixed(6)}
              <br />
              Lng: {entity.lng.toFixed(6)}
            </p>
            {entity.updated_at && (
              <p>
                <strong>Updated:</strong>
                <br />
                {new Date(entity.updated_at).toLocaleTimeString()}
              </p>
            )}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}
