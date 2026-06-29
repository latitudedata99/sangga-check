'use client'
import { useEffect, useRef } from 'react'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Window { kakao: any }
}

interface Props {
  lat: number
  lng: number
  radius: number
  address: string
}

export default function KakaoMap({ lat, lng, radius, address }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function initMap() {
      if (!containerRef.current || !window.kakao?.maps) return
      const center = new window.kakao.maps.LatLng(lat, lng)
      const map = new window.kakao.maps.Map(containerRef.current, { center, level: 5 })

      new window.kakao.maps.Marker({ map, position: center })

      new window.kakao.maps.InfoWindow({
        content: `<div style="padding:5px 10px;font-size:12px;white-space:nowrap">${address}</div>`,
        removable: true,
      }).open(map, new window.kakao.maps.Marker({ map, position: center }))

      new window.kakao.maps.Circle({
        map, center, radius,
        strokeWeight: 2, strokeColor: '#dc2626', strokeOpacity: 0.9,
        fillColor: '#dc2626', fillOpacity: 0.08,
      })
    }

    // 이미 로드된 경우
    if (window.kakao?.maps) {
      initMap()
      return
    }

    // 스크립트 직접 주입
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_KEY}&autoload=false`
    script.onload = () => window.kakao.maps.load(initMap)
    script.onerror = () => console.error('[KakaoMap] SDK 로드 실패')
    document.head.appendChild(script)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng])

  return (
    <div ref={containerRef} style={{ width: '100%', height: '280px' }} />
  )
}
