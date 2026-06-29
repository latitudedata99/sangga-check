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

function jitter(v: number, i: number, spread: number): number {
  const x = Math.sin(v * 127.1 + i * 311.7) * 43758.5453
  return (x - Math.floor(x) - 0.5) * 2 * spread
}

interface Props {
  distribution: Record<string, number[]>
}

export default function ViolinChart({ distribution }: Props) {
  const W = 560
  const H = 400
  const mg = { top: 30, right: 30, bottom: 70, left: 58 }
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
    const spread = colW * 0.25

    const items = FLOOR_ORDER.map((floor, idx) => {
      const vals = (distribution[floor] ?? []).filter(v => v > 0)
      if (vals.length < 3) return null

      const sorted = [...vals].sort((a, b) => a - b)
      const q1  = quantile(sorted, 0.25)
      const q3  = quantile(sorted, 0.75)
      const med = quantile(sorted, 0.5)
      const avg = vals.reduce((s, v) => s + v, 0) / vals.length

      const iqr = q3 - q1
      const loFence = q1 - 1.5 * iqr
      const hiFence = q3 + 1.5 * iqr
      const wLo = sorted.find(v => v >= loFence) ?? sorted[0]
      const wHi = [...sorted].reverse().find(v => v <= hiFence) ?? sorted[sorted.length - 1]

      const cx = colW * (idx + 0.5)
      const dots = vals.map((v, i) => ({ x: cx + jitter(v, i, spread), y: yScale(v) }))

      return {
        floor, cx, dots,
        yMed: yScale(med), yAvg: yScale(avg),
        yQ1: yScale(q1), yQ3: yScale(q3),
        yWLo: yScale(wLo), yWHi: yScale(wHi),
        med, avg, wLo, wHi, count: vals.length,
      }
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
            const bxW = 14  // IQR 박스 반너비
            const wkW = 8   // 위스커 캡 반너비

            return (
              <g key={v.floor}>
                {/* 데이터 점들 */}
                {v.dots.map((d, i) => (
                  <circle key={i} cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r={3} fill={c.fill} opacity={0.45} />
                ))}

                {/* max 레이블 */}
                <text x={v.cx} y={v.yWHi - 7} textAnchor="middle" fontSize={9.5} fill={c.stroke} fontWeight="600">
                  max: {v.wHi.toFixed(1)}
                </text>

                {/* 위스커 선 (Q3 위) */}
                <line x1={v.cx} x2={v.cx} y1={v.yWHi} y2={v.yQ3} stroke={c.stroke} strokeWidth={1.5} />
                {/* 위스커 캡 (상단) */}
                <line x1={v.cx - wkW} x2={v.cx + wkW} y1={v.yWHi} y2={v.yWHi} stroke={c.stroke} strokeWidth={1.5} />

                {/* 위스커 선 (Q1 아래) */}
                <line x1={v.cx} x2={v.cx} y1={v.yQ1} y2={v.yWLo} stroke={c.stroke} strokeWidth={1.5} />
                {/* 위스커 캡 (하단) */}
                <line x1={v.cx - wkW} x2={v.cx + wkW} y1={v.yWLo} y2={v.yWLo} stroke={c.stroke} strokeWidth={1.5} />

                {/* min 레이블 */}
                <text x={v.cx} y={v.yWLo + 14} textAnchor="middle" fontSize={9.5} fill={c.stroke} fontWeight="600">
                  min: {v.wLo.toFixed(1)}
                </text>

                {/* IQR 박스 */}
                <rect
                  x={v.cx - bxW} y={v.yQ3}
                  width={bxW * 2} height={Math.max(v.yQ1 - v.yQ3, 0)}
                  fill="white" fillOpacity={0.6}
                  stroke={c.stroke} strokeWidth={1.5} rx={2}
                />

                {/* 중앙값 선 */}
                <line
                  x1={v.cx - bxW} x2={v.cx + bxW}
                  y1={v.yMed} y2={v.yMed}
                  stroke={c.stroke} strokeWidth={3}
                />

                {/* 평균 다이아몬드 */}
                <polygon
                  points={[
                    `${v.cx},${v.yAvg - 6}`,
                    `${v.cx + 6},${v.yAvg}`,
                    `${v.cx},${v.yAvg + 6}`,
                    `${v.cx - 6},${v.yAvg}`,
                  ].join(' ')}
                  fill="white" stroke={c.stroke} strokeWidth={1.5}
                />

                {/* X 레이블 */}
                <text x={v.cx} y={iH + 20} textAnchor="middle" fontSize={13} fontWeight="600" fill="#1f2937">
                  {v.floor}
                </text>
                <text x={v.cx} y={iH + 35} textAnchor="middle" fontSize={10} fill="#6b7280">
                  중앙 {v.med.toFixed(1)} · 평균 {v.avg.toFixed(1)}
                </text>
                <text x={v.cx} y={iH + 50} textAnchor="middle" fontSize={10} fill="#9ca3af">
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
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 mt-3">
        {FLOOR_ORDER.map(f => (
          <div key={f} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[f as FloorType].fill }} />
            <span className="text-xs text-gray-600">{f}</span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <line x1="7" y1="0" x2="7" y2="14" stroke="#6b7280" strokeWidth="2" />
            <rect x="3" y="3" width="8" height="8" fill="white" stroke="#6b7280" strokeWidth="1.5" rx="1" />
            <line x1="3" y1="7" x2="11" y2="7" stroke="#374151" strokeWidth="2.5" />
          </svg>
          <span className="text-xs text-gray-500">위스커·IQR·중앙값</span>
        </div>
        <div className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <polygon points="7,1 13,7 7,13 1,7" fill="white" stroke="#6b7280" strokeWidth="1.5" />
          </svg>
          <span className="text-xs text-gray-500">평균</span>
        </div>
      </div>
    </div>
  )
}
