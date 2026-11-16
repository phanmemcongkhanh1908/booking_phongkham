import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Crosshair, MapPin } from 'lucide-react';

interface ClinicLocationMapProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
  clinicName?: string;
}

const DEFAULT_CENTER: [number, number] = [10.776889, 106.700806]; // TP.HCM center fallback

function createClinicPinIcon(): L.DivIcon {
  return L.divIcon({
    className: 'clinic-custom-pin-icon',
    html: `<div style="position:relative;width:34px;height:42px;display:flex;align-items:center;justify-content:center;filter:drop-shadow(0 4px 6px rgba(15,23,42,0.35));">
      <svg viewBox="0 0 36 44" width="34" height="42" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 2C9.716 2 3 8.716 3 17c0 10.5 15 24 15 24s15-13.5 15-24c0-8.284-6.716-15-15-15z" fill="#0d9488" stroke="#ffffff" stroke-width="2.5"/>
        <circle cx="18" cy="17" r="6" fill="#ffffff"/>
      </svg>
    </div>`,
    iconSize: [34, 42],
    iconAnchor: [17, 41],
    popupAnchor: [0, -38],
  });
}

export const ClinicLocationMap: React.FC<ClinicLocationMapProps> = ({
  latitude,
  longitude,
  onChange,
  clinicName,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const hasValidCoords =
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const initialCenter: [number, number] = hasValidCoords
      ? [latitude as number, longitude as number]
      : DEFAULT_CENTER;
    const initialZoom = hasValidCoords ? 16 : 6;

    const map = L.map(containerRef.current, {
      center: initialCenter,
      zoom: initialZoom,
      scrollWheelZoom: true,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    }).addTo(map);

    const marker = L.marker(initialCenter, {
      draggable: true,
      icon: createClinicPinIcon(),
      title: clinicName || 'Vị trí phòng khám',
    }).addTo(map);

    marker.on('dragend', () => {
      const pos = marker.getLatLng();
      onChangeRef.current(
        Number(pos.lat.toFixed(6)),
        Number(pos.lng.toFixed(6))
      );
    });

    map.on('click', (e: L.LeafletMouseEvent) => {
      const lat = Number(e.latlng.lat.toFixed(6));
      const lng = Number(e.latlng.lng.toFixed(6));
      marker.setLatLng([lat, lng]);
      onChangeRef.current(lat, lng);
    });

    mapRef.current = map;
    markerRef.current = marker;

    // Ensure proper layout when mounted inside cards/accordions
    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;

    if (hasValidCoords) {
      const nextLat = latitude as number;
      const nextLng = longitude as number;
      marker.setLatLng([nextLat, nextLng]);
      const currentZoom = map.getZoom();
      map.setView([nextLat, nextLng], currentZoom < 14 ? 16 : currentZoom, {
        animate: true,
      });
    }
  }, [latitude, longitude, hasValidCoords]);

  const handleRecenter = () => {
    const map = mapRef.current;
    if (!map) return;
    if (hasValidCoords) {
      map.setView([latitude as number, longitude as number], 17, { animate: true });
    } else {
      map.setView(DEFAULT_CENTER, 12, { animate: true });
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-slate-50 shadow-2xs">
      <div className="px-3 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-slate-700 font-medium">
          <MapPin className="w-3.5 h-3.5 text-teal-600 shrink-0" />
          <span>Nhấp trực tiếp lên bản đồ hoặc kéo ghim xanh để đặt đúng cổng phòng khám</span>
        </div>
        <button
          type="button"
          onClick={handleRecenter}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold transition-colors cursor-pointer"
        >
          <Crosshair className="w-3 h-3 text-teal-600" />
          <span>Về ghim</span>
        </button>
      </div>
      <div
        ref={containerRef}
        className="w-full h-64 sm:h-72 z-0"
        style={{ minHeight: '260px' }}
      />
    </div>
  );
};

export default ClinicLocationMap;
