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
  let query = supabase
    .from('sg_rent')
    .select('위도, 경도')
    .eq('동1', dongMatch[1])
    .not('위도', 'is', null)
    .limit(200)

  if (guMatch) query = query.eq('시구', guMatch[1])

  const { data, error } = await query
  if (error || !data?.length) throw new Error('해당 동의 매물 정보가 없습니다')

  const lat = data.reduce((s: number, r: { 위도: number }) => s + Number(r.위도), 0) / data.length
  const lng = data.reduce((s: number, r: { 경도: number }) => s + Number(r.경도), 0) / data.length

  return { address, roadAddress: `${guMatch?.[1] ?? ''} ${dongMatch[1]} 중심 (근사값)`, lat, lng }
}

export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  // 1차: 카카오 Local API
  try {
    return await geocodeKakao(address)
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    if (!msg.startsWith('kakao_4')) throw new Error('주소를 찾을 수 없습니다')
    // kakao 403/401 → 권한 없음 → 폴백
    console.warn('[geocode] 카카오 Local API 미활성 → DB 폴백')
  }

  // 2차: 자체 DB 기반 (동 중심 좌표)
  return geocodeFromDB(address)
}
