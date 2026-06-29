'use client'
import { useMemo } from 'react'
import { FloorType } from '@/types'

const FLOOR_ORDER: FloorType[] = ['1층', '지상층', '지하층']

const COLORS: Record<FloorType, { fill: string; stroke: string }> = {
  '1층':   { fill: '#3b82f6', stroke: '#1d4ed8' },
  '지상층': { fill: '#22c55e', stroke: '#15803d' },
  '지하층': { fill: '#ef4444', stroke: '#b91c1c' },
}

function quantile(sorted: number[], q: number) {
  const idx = q * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
}

// 결정론적 지터 (렌더마다 동일 위치)
function jitter(v: number, i: number, spread: number): number {
  const x = Math.sin(v * 127.1 + i * 311.7) * 43758.5453
  return (x - Math.floor(x) - 0.5) * 2 * spread
}

interface Props {
  distribution: Record<string, number[]>
}

export default function ViolinChart({ distribution }: Props) {
  const W = 560
  const H = 380
  const mg = { top: 30, right: 30, bottom: 60, left: 58 }
  const iW = W - mg.left - mg.right
  const iH = H - mg.top - mg.bottom

  const allVals = FLOOR_ORDER.flatMap(f => distribution[f] ?? [])

  const data = useMemo(() => {
    if (!allVals.length) return null

    const globalMin = Math.min(...allVals)
    const globalMax = Math.max(...allVals)
    const pad = (globalMax - globalMin) * 0.08
    const yMin = Math.max(0, globalMin - pad)
    const yMax = globalMax + pad

    const yScale = (v: number) => iH - ((v - yMin) / (yMax - yMin)) * iH
    const colW = iW / FLOOR_ORDER.length
    const spread = colW * 0.28

    const items = FLOOR_ORDER.map((floor, idx) => {
      const vals = (distribution[floor] ?? []).filter(v => v > 0)
      if (vals.length < 3) return null

      const sorted = [...vals].sort((a, b) => a - b)
      const q1  = quantile(sorted, 0.25)
      const q3  = quantile(sorted, 0.75)
      const med = quantile(sorted, 0.5)
      const cx  = colW * (idx + 0.5)

      const dots = vals.map((v, i) => ({
        x: cx + jitter(v, i, spread),
        y: yScale(v),
      }))

      return { floor, cx, dots, yMed: yScale(med), med, count: vals.length }
    })

    return { items: items.filter(Boolean), yMin, yMax, yScale }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(distribution)])

  if (!allVals.length || !data) {
    return <div className="text-sm text-gray-400 text-center py-8">분포 데이터 없음</div>
  }

  const { items, yMin, yMax, yScale } = data
  const TICK_COUNT = 6
  const yTicks = Array.from({ length: TICK_COUNT }, (_, i) => yMin + (yMax - yMin) * i / (TICK_COUNT - 1))

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-lg mx-auto">
        <g transform={`translate(${mg.left},${mg.top})`}>

          {/* 그리드 + Y 눈금 */}
          {yTicks.map(t => (
            <g key={t} transform={`translate(0,${yScale(t).toFixed(1)})`}>
              <line x1={0} x2={iW} stroke="#e5e7eb" strokeDasharray="3 3" />
              <text x={-8} dy="0.35em" textAnchor="end" fontSize={11} fill="#9ca3af">
                {t.toFixed(0)}
              </text>
            </g>
          ))}

          <line x1={0} y1={0} x2={0} y2={iH} stroke="#d1d5db" />

          {items.map(v => {
            if (!v) return null
            const c = COLORS[v.floor as FloorType]
            return (
              <g key={v.floor}>
                {/* 데이터 점들 */}
                {v.dots.map((d, i) => (
                  <circle
                    key={i}
                    cx={d.x.toFixed(1)}
                    cy={d.y.toFixed(1)}
                    r={3}
                    fill={c.fill}
                    opacity={0.55}
                  />
                ))}

                {/* 중앙값 선 */}
                <line
                  x1={v.cx - 20} x2={v.cx + 20}
                  y1={v.yMed} y2={v.yMed}
                  stroke={c.stroke} strokeWidth={3}
                />

                {/* 중앙값 레이블 */}
                <text x={v.cx} y={v.yMed - 9} textAnchor="middle" fontSize={11} fontWeight="700" fill={c.stroke}>
                  {v.med.toFixed(1)}
                </text>

                {/* X 레이블 */}
                <text x={v.cx} y={iH + 22} textAnchor="middle" fontSize={13} fontWeight="600" fill="#1f2937">
                  {v.floor}
                </text>
                <text x={v.cx} y={iH + 38} textAnchor="middle" fontSize={10} fill="#9ca3af">
                  {v.count.toLocaleString()}개
                </text>
              </g>
            )
          })}

          {/* Y축 레이블 */}
          <text
            transform={`translate(-44,${iH / 2}) rotate(-90)`}
            textAnchor="middle" fontSize={12} fill="#6b7280"
          >
            전용평단가 (만원/평)
          </text>
        </g>
      </svg>

      {/* 범례 */}
      <div className="flex justify-center gap-6 mt-2">
        {FLOOR_ORDER.map(f => (
          <div key={f} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[f as FloorType].fill }} />
            <span className="text-xs text-gray-600">{f}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-5 border-t-[3px]" style={{ borderColor: '#374151' }} />
          <span className="text-xs text-gray-500">중앙값</span>
        </div>
      </div>
    </div>
  )
}
