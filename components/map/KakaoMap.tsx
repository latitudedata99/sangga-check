'use client'
import { useEffect, useRef } from 'react'
import Script from 'next/script'

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    kakao: any
  }
}

interface Props {
  lat: number
  lng: number
  radius: number
  address: string
}

export default function KakaoMap({ lat, lng, radius, address }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  function initMap() {
    if (!containerRef.current || !window.kakao?.maps) return
    const center = new window.kakao.maps.LatLng(lat, lng)
    const map = new window.kakao.maps.Map(containerRef.current, { center, level: 5 })

    new window.kakao.maps.Marker({ map, position: center })

    const infoWindow = new window.kakao.maps.InfoWindow({
      content: `<div style="padding:6px 10px;font-size:12px;white-space:nowrap;">${address}</div>`,
      removable: true,
    })
    infoWindow.open(map, new window.kakao.maps.Marker({ position: center }))

    new window.kakao.maps.Circle({
      map,
      center,
      radius,
      strokeWeight: 2,
      strokeColor: '#dc2626',
      strokeOpacity: 0.9,
      fillColor: '#dc2626',
      fillOpacity: 0.08,
    })
  }

  useEffect(() => {
    if (window.kakao?.maps) {
      window.kakao.maps.load(initMap)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng])

  return (
    <>
      <Script
        src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`}
        strategy="afterInteractive"
        onLoad={() => window.kakao.maps.load(initMap)}
      />
      <div ref={containerRef} style={{ width: '100%', height: '280px' }} />
    </>
  )
}
