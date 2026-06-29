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

    // 전체 요약 (행 제한 없이 SQL 집계)
    const { data: summaryRows, error: sumErr } = await supabase.rpc('get_sg_rent_summary', {
      p_lng: lng,
      p_lat: lat,
      p_radius: radius,
    })
    if (sumErr) throw sumErr

    const s = summaryRows?.[0]
    const totalCount = Number(s?.total_count ?? 0)
    const medianPrice = Number(s?.median_price ?? 0)
    const avgPrice = Number(s?.avg_price ?? 0)

    // 층별 IQR 통계 (SQL에서 이상치 제거 포함)
    const { data: floorRows, error: floorErr } = await supabase.rpc('get_sg_rent_stats', {
      p_lng: lng,
      p_lat: lat,
      p_radius: radius,
    })
    if (floorErr) throw floorErr

    const byFloor = (floorRows ?? []).map((r: Record<string, unknown>) => ({
      floorType: r.floor_type as FloorType,
      count: Number(r.cnt),
      avgPrice: Number(r.avg_price),
      medianPrice: Number(r.median_price),
      minPrice: Number(r.min_price),
      maxPrice: Number(r.max_price),
      avgMonthlyRent: Number(r.avg_rent),
      avgDeposit: Number(r.avg_deposit),
    }))

    const verdict = computeVerdict(null, medianPrice)
    const verdictLabel = verdict ? VERDICT_LABEL[verdict] : '정보 없음'

    // 리포트 저장
    const { data: report } = await supabase
      .from('reports')
      .insert({
        address,
        lat,
        lng,
        radius,
        result_json: { summary: { totalCount, avgPrice, medianPrice }, byFloor },
      })
      .select('id')
      .single()

    return NextResponse.json({
      success: true,
      data: {
        reportId: report?.id ?? null,
        address,
        lat,
        lng,
        radius,
        analyzedAt: new Date().toISOString(),
        summary: {
          totalCount,
          verdict,
          verdictLabel,
          avgPricePerPyeong: avgPrice,
          medianPricePerPyeong: medianPrice,
          avgMonthlyRent: Number(s?.avg_rent ?? 0),
          avgDeposit: Number(s?.avg_deposit ?? 0),
        },
        byFloor,
        listings: null,
        history: null,
        negotiationHints: null,
      },
    })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ success: false, error: '분석 중 오류가 발생했습니다' }, { status: 500 })
  }
}
