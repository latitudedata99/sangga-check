import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { computeVerdict, VERDICT_LABEL } from '@/lib/analyze'
import { FloorType } from '@/types'

export async function POST(req: NextRequest) {
  const { lat, lng, radius = 500, address } = await req.json()

  if (!lat || !lng) {
    return NextResponse.json({ success: false, error: '좌표 정보가 없습니다' }, { status: 400 })
  }

  try {
    const supabase = await createClient()

    // 3개 RPC 병렬 호출
    const [summaryRes, floorRes, distRes] = await Promise.all([
      supabase.rpc('get_sg_rent_summary', { p_lng: lng, p_lat: lat, p_radius: radius }),
      supabase.rpc('get_sg_rent_stats',   { p_lng: lng, p_lat: lat, p_radius: radius }),
      supabase.rpc('get_sg_rent_distribution', { p_lng: lng, p_lat: lat, p_radius: radius }),
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
        listings:         null,
        history:          null,
        negotiationHints: null,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, error: '분석 중 오류가 발생했습니다' }, { status: 500 })
  }
}
