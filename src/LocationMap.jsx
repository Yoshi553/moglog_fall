import { useEffect, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

function RecenterMap({ position, zoom = 16 }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView(position, zoom);
  }, [map, position, zoom]);
  return null;
}

function LocationMapEvents({ onSelect }) {
  useMapEvents({
    click(event) {
      if (onSelect) {
        onSelect({ latitude: event.latlng.lat, longitude: event.latlng.lng });
      }
    },
  });
  return null;
}

const locationPinIcon = L.divIcon({
  className: "moglog-location-pin",
  html: "📍",
  iconSize: [32, 32],
  iconAnchor: [16, 30],
});

export function getPostPosition(post) {
  if (post?.gps?.latitude != null && post.gps.longitude != null) {
    return { latitude: post.gps.latitude, longitude: post.gps.longitude };
  }
  if (post?.pin?.x != null && post.pin?.y != null) {
    return {
      latitude: 35.681236 + (50 - post.pin.y) * 0.002,
      longitude: 139.767125 + (post.pin.x - 50) * 0.003,
    };
  }
  return null;
}

export function ReverseLocationName({ post, position, fallback = "位置未設定" }) {
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (post?.location?.trim() && post.location !== "場所未設定") {
      setAddress(post.location);
      return;
    }

    const current = position || getPostPosition(post);
    if (!current) {
      setAddress("");
      return;
    }

    const controller = new AbortController();
    fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${current.latitude}&lon=${current.longitude}&zoom=18&accept-language=ja`, {
      signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        const value = data.address || {};
        const prefecture = value.state || value.province || "";
        const city = value.city || value.town || value.village || value.municipality || "";
        const district = value.city_district || value.suburb || value.neighbourhood || "";
        const road = value.road || "";
        setAddress([prefecture, city, district, road].filter(Boolean).join(" "));
      })
      .catch(() => setAddress("位置情報を取得できませんでした"));

    return () => controller.abort();
  }, [post?.location, position?.latitude, position?.longitude]);

  if (post?.location?.trim() && post.location !== "場所未設定") return post.location;
  return address || fallback;
}

export async function getCityName(position) {
  if (!position?.latitude || !position?.longitude) return "";
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.latitude}&lon=${position.longitude}&zoom=10&accept-language=ja`);
    if (!response.ok) return "";
    const data = await response.json();
    const value = data.address || {};
    return value.city || value.town || value.village || value.municipality || "";
  } catch {
    return "";
  }
}

export default function LocationMap({ post, position, editable = false, onPositionChange, className = "" }) {
  const currentPosition = position || getPostPosition(post);
  const center = currentPosition
    ? [currentPosition.latitude, currentPosition.longitude]
    : [35.681236, 139.767125];

  const selectPosition = (nextPosition) => {
    if (editable && onPositionChange) onPositionChange(nextPosition);
  };

  return (
    <div className={`location-leaflet-map ${className}`}>
      <MapContainer
        center={center}
        zoom={currentPosition ? 16 : 11}
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {currentPosition && (
          <Marker
            position={[currentPosition.latitude, currentPosition.longitude]}
            icon={locationPinIcon}
            draggable={editable}
            eventHandlers={editable ? {
              dragend: (event) => {
                const next = event.target.getLatLng();
                selectPosition({ latitude: next.lat, longitude: next.lng });
              },
            } : undefined}
          />
        )}
        {currentPosition && <RecenterMap position={center} zoom={16} />}
        {editable && <LocationMapEvents onSelect={selectPosition} />}
      </MapContainer>
    </div>
  );
}
