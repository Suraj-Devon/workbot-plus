'use client'

import { useMemo } from 'react'
import { MapContainer, TileLayer, Marker } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'

export type GeoPoint = { lat: number; lon: number }

function makeDotIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `<div style="
      width: 10px; height: 10px; border-radius: 50%;
      background: ${color};
      border: 2px solid white;
      box-shadow: 0 1px 6px rgba(0,0,0,0.25);
    "></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  })
}

export default function GeoMap({ points }: { points: GeoPoint[] }) {
  const pts = (points || []).slice(0, 1000)

  const center: [number, number] = useMemo(() => {
    const first = pts[0]
    return first ? [first.lat, first.lon] : [20.5937, 78.9629]
  }, [pts])

  const dotIcon = useMemo(() => makeDotIcon('#2563eb'), [])

  if (!pts.length) return null

  return (
    <div className="card p-5 border-l-4 border-blue-500">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-900">🗺️ Geo Insights</h2>
        <p className="text-xs text-slate-500">Showing {pts.length.toLocaleString()} points (sample)</p>
      </div>

      <div className="rounded-xl overflow-hidden border border-slate-200">
        <MapContainer center={center} zoom={4} style={{ height: 420, width: '100%' }} scrollWheelZoom={false}>
          <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MarkerClusterGroup chunkedLoading>
            {pts.map((p, idx) => (
              <Marker key={idx} position={[p.lat, p.lon]} icon={dotIcon} />
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>
    </div>
  )
}
