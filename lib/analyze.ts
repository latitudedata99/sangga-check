import { FloorStats, FloorType, SgRentRow, Verdict } from '@/types'

export function removeOutliersIQR(values: number[]): number[] {
  if (values.length < 4) return values
  const sorted = [...values].sort((a, b) => a - b)
  const q1 = sorted[Math.floor(sorted.length * 0.25)]
  const q3 = sorted[Math.floor(sorted.length * 0.75)]
  const iqr = q3 - q1
  return values.filter(v => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr)
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function avg(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((a, b) => a + b, 0) / values.length
}

export function aggregateByFloor(listings: SgRentRow[]): FloorStats[] {
  const floorTypes: FloorType[] = ['1층', '지상층', '지하층']

  return floorTypes
    .map(floorType => {
      const rows = listings.filter(r => r.층_구분 === floorType)
      if (rows.length === 0) return null

      const prices = removeOutliersIQR(rows.map(r => r.전용평단가).filter(Boolean))
      const rents = rows.map(r => r.월세).filter(Boolean)
      const deposits = rows.map(r => r.보증금).filter(Boolean)

      return {
        floorType,
        count: rows.length,
        avgPrice: Math.round(avg(prices) * 10) / 10,
        medianPrice: Math.round(median(prices) * 10) / 10,
        minPrice: Math.round(Math.min(...prices) * 10) / 10,
        maxPrice: Math.round(Math.max(...prices) * 10) / 10,
        avgMonthlyRent: Math.round(avg(rents)),
        avgDeposit: Math.round(avg(deposits)),
      } as FloorStats
    })
    .filter((s): s is FloorStats => s !== null)
}

export function computeVerdict(
  targetPrice: number | null,
  medianPrice: number
): Verdict | null {
  if (!targetPrice || !medianPrice) return null
  if (targetPrice > medianPrice * 1.15) return 'high'
  if (targetPrice < medianPrice * 0.85) return 'low'
  return 'average'
}

export const VERDICT_LABEL: Record<Verdict, string> = {
  high: '주변 대비 높은 편',
  average: '주변 평균 수준',
  low: '주변 대비 저렴한 편',
}
