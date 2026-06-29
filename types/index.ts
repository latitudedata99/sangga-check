export type FloorType = '1층' | '지상층' | '지하층'
export type Verdict = 'high' | 'average' | 'low'

export interface SgRentRow {
  id: number
  도: string
  시구: string
  동1: string
  층_구분: FloorType
  보증금: number
  월세: number
  전용면적: number
  전용평수: number
  전용평단가: number
  주소: string
  위도: number
  경도: number
}

export interface FloorStats {
  floorType: FloorType
  count: number
  avgPrice: number
  medianPrice: number
  minPrice: number
  maxPrice: number
  avgMonthlyRent: number
  avgDeposit: number
}

export interface AnalyzeResult {
  reportId: string
  address: string
  lat: number
  lng: number
  radius: number
  analyzedAt: string
  summary: {
    totalCount: number
    verdict: Verdict | null
    verdictLabel: string
    avgPricePerPyeong: number
    medianPricePerPyeong: number
    avgMonthlyRent: number
    avgDeposit: number
  }
  byFloor: FloorStats[]
  listings: SgRentRow[] | null
  history: HistoryRow[] | null
  negotiationHints: string[] | null
}

export interface HistoryRow {
  id: number
  시구: string
  동1: string
  층_구분: FloorType
  보증금: number
  월세: number
  전용평수: number
  월세평단가: number
  주소: string
}

export interface GeocodeResult {
  address: string
  roadAddress: string
  lat: number
  lng: number
}
