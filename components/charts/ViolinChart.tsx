'use client'
import { useMemo } from 'react'
import { FloorType } from '@/types'

const FLOOR_ORDER: FloorType[] = ['1층', '지상층', '지하층']

const COLORS: Record<FloorType, { fill: string; stroke: string; label: string }> = {
  '1층':   { fill: '#bfdbfe', stroke: '#2563eb', label: '1층' },
  '지상층': { fill: '#bbf7d0', stroke: '#16a34a', label: '지상층' },
  '지하층': { fill: '#fecaca', stroke: '#dc2626', label: '지하층' },
}

function epanechnikov(bw: number) {
  return (u: number) => {
    const x = u / bw
    return Math.abs(x) <= 1 ? (0.75 * (1 - x * x)) / bw : 0
  }
}

function kde(kernel: (u: number) => number, values: number[], thresholds: number[]) {
  const n = values.length
  return thresholds.map(t => ({
    t,
    d: values.reduce((s, v) => s + kernel(t - v), 0) / n,
  }))
}

function quantile(sorted: number[], q: number) {
  const idx = q * (sorted.length - 1)
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo)
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

  const violins = useMemo(() => {
    if (!allVals.length) return []

    const globalMin = Math.min(...allVals)
    const globalMax = Math.max(...allVals)
    const pad = (globalMax - globalMin) * 0.08
    const yMin = Math.max(0, globalMin - pad)
    const yMax = globalMax + pad

    const yScale = (v: number) => iH - ((v - yMin) / (yMax - yMin)) * iH
    const colW = iW / FLOOR_ORDER.length

    const STEPS = 100
    const thresholds = Array.from({ length: STEPS }, (_, i) => yMin + (yMax - yMin) * (i / (STEPS - 1)))

    const result = FLOOR_ORDER.map((floor, idx) => {
      const vals = (distribution[floor] ?? []).filter(v => v > 0)
      if (vals.length < 3) return null

      const sorted = [...vals].sort((a, b) => a - b)
      const q1     = quantile(sorted, 0.25)
      const q3     = quantile(sorted, 0.75)
      const med    = quantile(sorted, 0.5)
      const bw     = Math.max((q3 - q1) * 0.5, 0.5)

      const density = kde(epanechnikov(bw), vals, thresholds)
      const maxD    = Math.max(...density.map(p => p.d), 1e-9)
      const violinW = colW * 0.72
      const cx      = colW * (idx + 0.5)

      // violin 경로 (left → top → right → bottom → close)
      const left  = density.map(p => [cx - (p.d / maxD) * (violinW / 2), yScale(p.t)] as [number, number])
      const right = [...density].reverse().map(p => [cx + (p.d / maxD) * (violinW / 2), yScale(p.t)] as [number, number])
      const pts   = [...left, ...right]
      const path  = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ') + ' Z'

      // 위스커: IQR 1.5배 범위 내 실제 최소/최대
      const loFence = q1 - 1.5 * (q3 - q1)
      const hiFence = q3 + 1.5 * (q3 - q1)
      const wLo = sorted.find(v => v >= loFence) ?? sorted[0]
      const wHi = [...sorted].reverse().find(v => v <= hiFence) ?? sorted[sorted.length - 1]

      return {
        floor, path, cx,
        yMed: yScale(med), yQ1: yScale(q1), yQ3: yScale(q3),
        yWLo: yScale(wLo), yWHi: yScale(wHi),
        med, q1, q3, count: vals.length, yMin, yMax,
      }
    })

    return { items: result.filter(Boolean), yMin, yMax, yScale }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(distribution)])

  if (!allVals.length || typeof violins === 'undefined' || !('items' in violins)) {
    return <div className="text-sm text-gray-400 text-center py-8">분포 데이터 없음</div>
  }

  const { items, yMin, yMax, yScale } = violins
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

          {/* Y축 선 */}
          <line x1={0} y1={0} x2={0} y2={iH} stroke="#d1d5db" />

          {/* 바이올린들 */}
          {items.map(v => {
            if (!v) return null
            const c = COLORS[v.floor as FloorType]
            const bxW = 12
            return (
              <g key={v.floor}>
                {/* violin 몸통 */}
                <path d={v.path} fill={c.fill} stroke={c.stroke} strokeWidth={1.5} opacity={0.9} />

                {/* 위스커 */}
                <line x1={v.cx} x2={v.cx} y1={v.yWHi} y2={v.yQ3} stroke={c.stroke} strokeWidth={1.5} strokeDasharray="3 2" />
                <line x1={v.cx} x2={v.cx} y1={v.yQ1} y2={v.yWLo} stroke={c.stroke} strokeWidth={1.5} strokeDasharray="3 2" />

                {/* IQR 박스 */}
                <rect
                  x={v.cx - bxW / 2} y={v.yQ3}
                  width={bxW} height={Math.max(v.yQ1 - v.yQ3, 0)}
                  fill="white" stroke={c.stroke} strokeWidth={2} rx={2}
                />

                {/* 중앙값 선 */}
                <line
                  x1={v.cx - bxW / 2 - 2} x2={v.cx + bxW / 2 + 2}
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
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[f as FloorType].fill, border: `1.5px solid ${COLORS[f as FloorType].stroke}` }} />
            <span className="text-xs text-gray-600">{f}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-5 border-t-2 border-gray-400" style={{ borderStyle: 'dashed' }} />
          <span className="text-xs text-gray-500">IQR 범위</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-5 border-t-[3px]" style={{ borderColor: '#374151' }} />
          <span className="text-xs text-gray-500">중앙값</span>
        </div>
      </div>
    </div>
  )
}
