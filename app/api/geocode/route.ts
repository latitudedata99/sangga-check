import { NextRequest, NextResponse } from 'next/server'
import { geocodeAddress } from '@/lib/geocode'

export async function POST(req: NextRequest) {
  const { address } = await req.json()
  if (!address?.trim()) {
    return NextResponse.json({ success: false, error: '주소를 입력해주세요' }, { status: 400 })
  }

  try {
    const result = await geocodeAddress(address)
    return NextResponse.json({ success: true, data: result })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '지오코딩 실패'
    return NextResponse.json({ success: false, error: msg }, { status: 400 })
  }
}
