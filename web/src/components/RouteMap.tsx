import { useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, useMap } from 'react-leaflet'
import type { Airport } from '../lib/flightEngine'
import 'leaflet/dist/leaflet.css'

function FitBounds({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds([points[0], points[1]], { padding: [14, 14], maxZoom: 5 })
    }
  }, [map, points])
  return null
}

type RouteMapProps = { origin: Airport; destination: Airport }

export function RouteMap({ origin, destination }: RouteMapProps) {
  if (!origin?.location || !destination?.location) return null
  const o: [number, number] = [origin.location.latitude, origin.location.longitude]
  const d: [number, number] = [destination.location.latitude, destination.location.longitude]

  return (
    <div className="dashboard__route-map">
      <MapContainer
        center={o}
        zoom={3}
        scrollWheelZoom={false}
        className="dashboard__route-map-inner"
        style={{ height: '100%', width: '100%', borderRadius: 8 }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        />
        <FitBounds points={[o, d]} />
        <CircleMarker
          center={o}
          radius={5}
          pathOptions={{ color: '#22c55e', fillColor: '#22c55e', fillOpacity: 1, weight: 2 }}
        />
        <CircleMarker
          center={d}
          radius={5}
          pathOptions={{ color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 1, weight: 2 }}
        />
      </MapContainer>
    </div>
  )
}
