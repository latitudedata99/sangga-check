import { GeocodeResult } from '@/types'
import { createClient } from '@/lib/supabase/server'

async function geocodeKakao(address: string): Promise<GeocodeResult> {
  const res = await fetch(
    `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
    {
      headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
      cache: 'no-store',
    }
  )
  if (!res.ok) throw new Error(`kakao_${res.status}`)

  const data = await res.json()
  const doc = data.documents?.[0]
  if (!doc) throw new Error('no_result')

  return {
    address: doc.address?.address_name ?? address,
    roadAddress: doc.road_address?.address_name ?? '',
    lat: parseFloat(doc.y),
    lng: parseFloat(doc.x),
  }
}

// 자체 DB 기반 폴백: 입력 주소에서 동 이름 추출 → sg_rent 테이블 중심 좌표
async function geocodeFromDB(address: string): Promise<GeocodeResult> {
  // 동 이름 추출 (예: "서울 마포구 망원동 472-1" → "망원동")
  const dongMatch = address.match(/([가-힣]+동)/)
  // 구 이름 추출 (예: "마포구")
  const guMatch = address.match(/([가-힣]+구)/)

  if (!dongMatch) throw new Error('동 정보를 찾을 수 없습니다')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('sg_rent')
    .select('*')
    .eq('동1', dongMatch[1])
    .eq('시구', guMatch?.[1] ?? '')
    .not('위도', 'is', null)
    .limit(200)

  if (error || !data?.length) throw new Error('해당 동의 매물 정보가 없습니다')

  const len = data.length
  let sumLat = 0, sumLng = 0
  for (const r of data) { sumLat += Number(r.위도); sumLng += Number(r.경도) }
  const lat = sumLat / len
  const lng = sumLng / len

  return { address, roadAddress: `${guMatch?.[1] ?? ''} ${dongMatch[1]} 중심 (근사값)`, lat, lng }
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  // 1차: 카카오 Local API
  try {
    return await geocodeKakao(address)
  } catch (e) {
    console.warn('[geocode] 카카오 실패 → DB 폴백:', e instanceof Error ? e.message : e)
  }

  // 2차: 자체 DB 기반 (동 중심 좌표)
  return geocodeFromDB(address)
}
