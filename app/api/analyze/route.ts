import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeVerdict, VERDICT_LABEL } from '@/lib/analyze'
import { FloorStats, FloorType, SgRentRow, HistoryRow } from '@/types'

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

    // 7개 RPC 병렬 호출
    const [summaryRes, floorRes, distRes, listingsRes, historyRes, priceGapRes, areaSegRes] = await Promise.all([
      supabase.rpc('get_sg_rent_summary', { p_lng: lng, p_lat: lat, p_radius: radius }),
      supabase.rpc('get_sg_rent_stats',   { p_lng: lng, p_lat: lat, p_radius: radius }),
      supabase.rpc('get_sg_rent_distribution', { p_lng: lng, p_lat: lat, p_radius: radius }),
      supabase.rpc('get_sg_rent_listings', { p_lng: lng, p_lat: lat, p_radius: radius }),
      supabase.rpc('get_sg_rent_history_nearby', { p_lng: lng, p_lat: lat, p_radius: radius }),
      supabase.rpc('get_price_gap_analysis', { p_lng: lng, p_lat: lat, p_radius: radius }),
      supabase.rpc('get_area_segment_stats', { p_lng: lng, p_lat: lat, p_radius: radius }),
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
          count:       Number(r.cnt),
          avgPrice:    Number(r.avg_price),
          medianPrice: Number(r.median_price),
        })),
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, error: '분석 중 오류가 발생했습니다' }, { status: 500 })
  }
}
