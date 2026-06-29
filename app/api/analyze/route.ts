import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeVerdict, VERDICT_LABEL } from '@/lib/analyze'
import { FloorStats, FloorType, SgRentRow, HistoryRow } from '@/types'

// ── 카카오 로컬 API ──────────────────────────────────────────
const KAKAO_CATEGORIES = [
  { code: 'CE7', name: '카페' },
  { code: 'FD6', name: '음식점' },
  { code: 'CS2', name: '편의점' },
  { code: 'AC5', name: '학원' },
  { code: 'PM9', name: '약국' },
  { code: 'HP8', name: '병원' },
]

async function fetchKakaoCategory(code: string, lng: number, lat: number, radius: number) {
  const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=${code}&x=${lng}&y=${lat}&radius=${radius}&size=15`
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
    cache: 'no-store',
  })
  if (!res.ok) return { count: 0 }
  const data = await res.json()
  return { count: data.meta?.total_count ?? 0 }
}

async function fetchNearestSubway(lng: number, lat: number) {
  const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=SW8&x=${lng}&y=${lat}&radius=2000&sort=distance&size=3`
  const res = await fetch(url, {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
    cache: 'no-store',
  })
  if (!res.ok) return []
  const data = await res.json()
  return (data.documents ?? []).map((d: Record<string, unknown>) => ({
    name: d.place_name as string,
    distance: Number(d.distance),
  }))
}

// ── 소상공인시장진흥공단 업종 분포 ─────────────────────────────
interface BizDistItem {
  name: string
  count: number
  pct: number
  topMcls: Array<{ name: string; count: number }>
}

async function fetchBusinessDistribution(lat: number, lng: number, radius: number) {
  const key = process.env.DATA_GO_KR_KEY
  if (!key) return null
  try {
    const url = `https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius?serviceKey=${encodeURIComponent(key)}&pageNo=1&numOfRows=1000&radius=${radius}&cx=${lng}&cy=${lat}&type=json`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null

    const data = await res.json()
    if (data.header?.resultCode !== '00') return null

    const items = (data.body?.items ?? []) as Record<string, string>[]
    const totalBiz: number = data.body?.totalCount ?? 0
    const sampled = items.length
    if (sampled === 0) return { totalBiz: 0, sampled: 0, byLcls: [] }

    function mapFloor(flrNo: string): string | null {
      if (!flrNo) return null
      if (flrNo.startsWith('지')) return '지하층'
      if (flrNo === '1') return '1층'
      return '지상층'
    }

    const lcls: Record<string, { count: number; mcls: Record<string, number> }> = {}
    const floorLcls: Record<string, Record<string, number>> = { '1층': {}, '지상층': {}, '지하층': {} }

    for (const item of items) {
      const lnm = item.indsLclsNm
      const mnm = item.indsMclsNm
      if (!lcls[lnm]) lcls[lnm] = { count: 0, mcls: {} }
      lcls[lnm].count++
      lcls[lnm].mcls[mnm] = (lcls[lnm].mcls[mnm] ?? 0) + 1

      const ft = mapFloor(item.flrNo)
      if (ft) floorLcls[ft][lnm] = (floorLcls[ft][lnm] ?? 0) + 1
    }

    const ratio = totalBiz / sampled

    const byLcls: BizDistItem[] = Object.entries(lcls)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 8)
      .map(([name, v]) => ({
        name,
        count: Math.round(v.count * ratio),
        pct: Math.round((v.count / sampled) * 1000) / 10,
        topMcls: Object.entries(v.mcls)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([n, c]) => ({ name: n, count: Math.round(c * ratio) })),
      }))

    const byFloor = (['1층', '지상층', '지하층'] as const).map(ft => {
      const entries = Object.entries(floorLcls[ft])
      const total = entries.reduce((s, [, c]) => s + c, 0)
      return {
        floorType: ft,
        total: Math.round(total * ratio),
        topLcls: entries
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([n, c]) => ({
            name: n,
            count: Math.round(c * ratio),
            pct: total > 0 ? Math.round((c / total) * 1000) / 10 : 0,
          })),
      }
    }).filter(f => f.total > 0)

    return { totalBiz, sampled, byLcls, byFloor }
  } catch {
    return null
  }
}

function buildNegotiationHints(
  medianPrice: number,
  avgPrice: number,
  byFloor: FloorStats[],
  totalCount: number,
): string[] {
  const hints: string[] = []

  const floor1 = byFloor.find(f => f.floorType === '1층')
  const basement = byFloor.find(f => f.floorType === '지하층')

  // 1층 시세가 전체 중앙값의 1.2배 이상
  if (floor1 && medianPrice > 0 && floor1.medianPrice >= medianPrice * 1.2) {
    hints.push(
      '1층 시세가 주변 평균보다 높습니다. 보증금 상향이나 인테리어 지원을 협상 포인트로 활용하세요.'
    )
  }

  // 지하층 데이터가 있을 때 지상 vs 지하 차이
  if (basement && floor1 && floor1.medianPrice > 0 && basement.medianPrice > 0) {
    const diffPct = Math.round(((floor1.medianPrice - basement.medianPrice) / basement.medianPrice) * 100)
    hints.push(
      `지하층 대비 지상층 단가 차이가 ${diffPct}% 입니다. 층 조건에 따른 가격 조정 협상이 가능합니다.`
    )
  }

  // 충분한 비교 매물
  if (totalCount >= 100) {
    hints.push(
      `비교 가능한 매물이 충분합니다. 중앙값(${medianPrice}만원/평)을 기준으로 협상을 시작하세요.`
    )
  }

  // 항상 포함
  hints.push('호가 데이터 기준이므로 실제 계약가는 5~15% 낮게 협상 가능합니다.')

  return hints
}

export async function POST(req: NextRequest) {
  const { lat, lng, radius = 500, address } = await req.json()

  if (!lat || !lng) {
    return NextResponse.json({ success: false, error: '좌표 정보가 없습니다' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    // 7개 RPC + 카카오 API + 소상공인 API 병렬 호출
    const [
      [summaryRes, floorRes, distRes, listingsRes, historyRes, priceGapRes, areaSegRes],
      competitionData,
      transitData,
      businessDist,
    ] = await Promise.all([
      Promise.all([
        supabase.rpc('get_sg_rent_summary', { p_lng: lng, p_lat: lat, p_radius: radius }),
        supabase.rpc('get_sg_rent_stats',   { p_lng: lng, p_lat: lat, p_radius: radius }),
        supabase.rpc('get_sg_rent_distribution', { p_lng: lng, p_lat: lat, p_radius: radius }),
        supabase.rpc('get_sg_rent_listings', { p_lng: lng, p_lat: lat, p_radius: radius }),
        supabase.rpc('get_sg_rent_history_nearby', { p_lng: lng, p_lat: lat, p_radius: radius }),
        supabase.rpc('get_price_gap_analysis', { p_lng: lng, p_lat: lat, p_radius: radius }),
        supabase.rpc('get_area_segment_stats', { p_lng: lng, p_lat: lat, p_radius: radius }),
      ]),
      Promise.all(
        KAKAO_CATEGORIES.map(c =>
          fetchKakaoCategory(c.code, lng, lat, radius).then(r => ({
            category: c.name,
            code: c.code,
            count: r.count,
          }))
        )
      ),
      fetchNearestSubway(lng, lat),
      fetchBusinessDistribution(lat, lng, radius),
    ])

    if (summaryRes.error) throw summaryRes.error
    if (floorRes.error)   throw floorRes.error
    if (distRes.error)    throw distRes.error

    const s = summaryRes.data?.[0]
    const totalCount  = Number(s?.total_count  ?? 0)
    const medianPrice = Number(s?.median_price ?? 0)
    const avgPrice    = Number(s?.avg_price    ?? 0)

    const byFloor = (floorRes.data ?? []).map((r: Record<string, unknown>) => ({
      floorType:      r.floor_type as FloorType,
      count:          Number(r.cnt),
      avgPrice:       Number(r.avg_price),
      medianPrice:    Number(r.median_price),
      minPrice:       Number(r.min_price),
      maxPrice:       Number(r.max_price),
      avgMonthlyRent: Number(r.avg_rent),
      avgDeposit:     Number(r.avg_deposit),
    }))

    // 바이올린 차트용 분포 데이터 (층별 그룹핑)
    const distribution: Record<string, number[]> = { '1층': [], '지상층': [], '지하층': [] }
    for (const row of (distRes.data ?? []) as Array<{ floor_type: string; price: number }>) {
      if (distribution[row.floor_type]) distribution[row.floor_type].push(Number(row.price))
    }

    // 매물 리스트 매핑 (에러 시 빈 배열)
    const listings: SgRentRow[] = (listingsRes.data ?? []).map((r: Record<string, unknown>) => ({
      id:       Number(r.id),
      도:       '',
      시구:     '',
      동1:      '',
      층_구분:  r.층_구분 as FloorType,
      보증금:   Number(r.보증금),
      월세:     Number(r.월세),
      전용면적: 0,
      전용평수: Number(r.전용평수),
      전용평단가: Number(r.전용평단가),
      주소:     String(r.주소 ?? ''),
      위도:     Number(r.위도),
      경도:     Number(r.경도),
    }))

    // 실거래 사례 매핑 (에러 시 빈 배열)
    const history: HistoryRow[] = (historyRes.data ?? []).map((r: Record<string, unknown>) => ({
      id:         Number(r.id),
      시구:       '',
      동1:        '',
      층_구분:    r.층_구분 as FloorType,
      보증금:     Number(r.보증금),
      월세:       Number(r.월세),
      전용평수:   Number(r.전용평수),
      전용평단가: Number(r.전용평단가),
      월세평단가: Number(r.월세평단가),
      주소:       String(r.주소 ?? ''),
    }))

    // 협상 포인트 자동 생성
    const negotiationHints = buildNegotiationHints(medianPrice, avgPrice, byFloor, totalCount)

    const verdict      = computeVerdict(null, medianPrice)
    const verdictLabel = verdict ? VERDICT_LABEL[verdict] : '정보 없음'

    const { data: report } = await supabase
      .from('reports')
      .insert({
        address, lat, lng, radius,
        result_json: { summary: { totalCount, avgPrice, medianPrice }, byFloor },
      })
      .select('id')
      .single()

    return NextResponse.json({
      success: true,
      data: {
        reportId:    report?.id ?? null,
        address, lat, lng, radius,
        analyzedAt:  new Date().toISOString(),
        summary: {
          totalCount, verdict, verdictLabel,
          avgPricePerPyeong:    avgPrice,
          medianPricePerPyeong: medianPrice,
          avgMonthlyRent: Number(s?.avg_rent    ?? 0),
          avgDeposit:     Number(s?.avg_deposit ?? 0),
        },
        byFloor,
        distribution,
        listings,
        history,
        negotiationHints,
        priceGap: (priceGapRes.data ?? []).map((r: Record<string, unknown>) => ({
          floorType:        r.floor_type as string,
          avgListingPrice:  Number(r.avg_listing_price),
          avgActualPrice:   Number(r.avg_actual_price),
          gapPct:           Number(r.gap_pct),
        })),
        areaSegments: (areaSegRes.data ?? []).map((r: Record<string, unknown>) => ({
          segment:     r.segment as string,
          areaRange:   r.area_range as string,
          floorType:   r.floor_type as string,
          count:       Number(r.cnt),
          avgPrice:    Number(r.avg_price),
          medianPrice: Number(r.median_price),
        })),
        competition: competitionData,
        transit: transitData,
        businessDist,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, error: '분석 중 오류가 발생했습니다' }, { status: 500 })
  }
}
