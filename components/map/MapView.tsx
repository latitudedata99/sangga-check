'use client'
import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Circle, Popup } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Next.js 환경에서 leaflet 기본 마커 아이콘 경로 깨짐 수정
function fixLeafletIcon() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

interface Props {
  lat: number
  lng: number
  radius: number
  address: string
}

export default function MapView({ lat, lng, radius, address }: Props) {
  useEffect(() => { fixLeafletIcon() }, [])

  return (
    <MapContainer
      center={[lat, lng]}
      zoom={15}
      scrollWheelZoom={false}
      style={{ height: '280px', width: '100%', borderRadius: '8px' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Circle
        center={[lat, lng]}
        radius={radius}
        pathOptions={{ color: '#dc2626', fillColor: '#dc2626', fillOpacity: 0.08, weight: 2 }}
      />
      <Marker position={[lat, lng]}>
        <Popup>{address}</Popup>
      </Marker>
    </MapContainer>
  )
}
