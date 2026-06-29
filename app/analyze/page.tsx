'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { AnalyzeResult, FloorType } from '@/types'
import ViolinChart from '@/components/charts/ViolinChart'

const KakaoMap = dynamic(() => import('@/components/map/KakaoMap'), { ssr: false })

type DetailTab = 'listings' | 'history' | 'negotiation'

const floorBadgeStyle: Record<FloorType, string> = {
  '1층':  'bg-blue-100 text-blue-700',
  '지상층': 'bg-green-100 text-green-700',
  '지하층': 'bg-red-100 text-red-700',
}

export default function AnalyzePage() {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<DetailTab>('listings')

  async function handleAnalyze() {
    if (!address.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const geoRes = await fetch('/api/geocode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })
      const geoData = await geoRes.json()
      if (!geoData.success) throw new Error(geoData.error)

      const { lat, lng } = geoData.data

      const analyzeRes = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, address, radius: 500 }),
      })
      const analyzeData = await analyzeRes.json()
      if (!analyzeData.success) throw new Error(analyzeData.error)

      setResult(analyzeData.data)
    } catch (e) {
      setError(e instanceof Error ? e.message : '분석 실패')
    } finally {
      setLoading(false)
    }
  }

  const verdictStyle = {
    high: 'bg-red-100 text-red-700 border-red-300',
    average: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    low: 'bg-green-100 text-green-700 border-green-300',
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">상가 월세 검증</h1>
        <p className="text-gray-500 mb-8">상가 주소를 입력하면 반경 500m 내 시세와 비교해드립니다.</p>

        <div className="flex gap-2 mb-8">
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            placeholder="예) 서울 마포구 망원동 123-4"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAnalyze}
            disabled={loading || !address.trim()}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            {loading ? '분석 중...' : '검색'}
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm mb-6">
            {error}
          </div>
        )}

        {result && (
          <div className="space-y-6">
            {/* 지도 */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <KakaoMap lat={result.lat} lng={result.lng} radius={result.radius} address={result.address} />
              <p className="text-xs text-gray-400 text-center py-2">
                📍 {result.address} · 반경 {result.radius}m
              </p>
            </div>

            {/* 요약 카드 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-gray-400 mb-1">📍 {result.address}</p>
                  <p className="text-sm text-gray-500">반경 {result.radius}m · 비교 매물 {result.summary.totalCount}개</p>
                </div>
                {result.summary.verdict && (
                  <span className={`text-sm font-semibold px-3 py-1 rounded-full border ${verdictStyle[result.summary.verdict]}`}>
                    {result.summary.verdictLabel}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">주변 평균 평단가</p>
                  <p className="text-xl font-bold text-gray-900">{result.summary.avgPricePerPyeong}<span className="text-sm font-normal text-gray-500">만원/평</span></p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">주변 중간값 평단가</p>
                  <p className="text-xl font-bold text-gray-900">{result.summary.medianPricePerPyeong}<span className="text-sm font-normal text-gray-500">만원/평</span></p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">주변 평균 월세</p>
                  <p className="text-xl font-bold text-gray-900">{result.summary.avgMonthlyRent}<span className="text-sm font-normal text-gray-500">만원</span></p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-400 mb-1">주변 평균 보증금</p>
                  <p className="text-xl font-bold text-gray-900">{result.summary.avgDeposit}<span className="text-sm font-normal text-gray-500">만원</span></p>
                </div>
              </div>
            </div>

            {/* 층별 분포 (바이올린 차트) */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-1">층별 전용평단가 분포</h2>
              <p className="text-xs text-gray-400 mb-4">IQR 기반 이상치 제거 후 커널 밀도 추정</p>
              <ViolinChart distribution={result.distribution} />
            </div>

            {/* 상세 리포트 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {/* 탭 헤더 */}
              <div className="flex border-b border-gray-200">
                {(
                  [
                    { key: 'listings',    label: '매물 리스트' },
                    { key: 'history',     label: '실거래 사례' },
                    { key: 'negotiation', label: '협상 포인트' },
                  ] as { key: DetailTab; label: string }[]
                ).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex-1 py-3 text-sm font-medium transition-colors ${
                      activeTab === tab.key
                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 매물 리스트 탭 */}
              {activeTab === 'listings' && (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  {(!result.listings || result.listings.length === 0) ? (
                    <p className="text-center text-gray-400 text-sm py-8">매물 데이터가 없습니다.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">주소</th>
                          <th className="text-center px-3 py-2 text-xs text-gray-500 font-medium">층구분</th>
                          <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">보증금</th>
                          <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">월세</th>
                          <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">전용평수</th>
                          <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">평단가</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {result.listings.map(row => (
                          <tr key={row.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-700 max-w-[180px] truncate" title={row.주소}>
                              {row.주소}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${floorBadgeStyle[row.층_구분] ?? 'bg-gray-100 text-gray-600'}`}>
                                {row.층_구분}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.보증금.toLocaleString()}만</td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.월세.toLocaleString()}만</td>
                            <td className="px-3 py-2 text-right text-gray-500">{row.전용평수}평</td>
                            <td className="px-4 py-2 text-right font-medium text-gray-900">{row.전용평단가}만/평</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* 실거래 사례 탭 */}
              {activeTab === 'history' && (
                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                  {(!result.history || result.history.length === 0) ? (
                    <p className="text-center text-gray-400 text-sm py-8">실거래 사례가 없습니다.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="text-left px-4 py-2 text-xs text-gray-500 font-medium">주소</th>
                          <th className="text-center px-3 py-2 text-xs text-gray-500 font-medium">층구분</th>
                          <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">보증금</th>
                          <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">월세</th>
                          <th className="text-right px-3 py-2 text-xs text-gray-500 font-medium">전용평수</th>
                          <th className="text-right px-4 py-2 text-xs text-gray-500 font-medium">평단가</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {result.history.map(row => (
                          <tr key={row.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2 text-gray-700 max-w-[180px] truncate" title={row.주소}>
                              {row.주소}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${floorBadgeStyle[row.층_구분] ?? 'bg-gray-100 text-gray-600'}`}>
                                {row.층_구분}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.보증금.toLocaleString()}만</td>
                            <td className="px-3 py-2 text-right text-gray-700">{row.월세.toLocaleString()}만</td>
                            <td className="px-3 py-2 text-right text-gray-500">{row.전용평수}평</td>
                            <td className="px-4 py-2 text-right font-medium text-gray-900">{row.전용평단가}만/평</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* 협상 포인트 탭 */}
              {activeTab === 'negotiation' && (
                <div className="p-6 space-y-3">
                  {(!result.negotiationHints || result.negotiationHints.length === 0) ? (
                    <p className="text-center text-gray-400 text-sm py-4">협상 포인트 정보가 없습니다.</p>
                  ) : (
                    result.negotiationHints.map((hint, idx) => (
                      <div key={idx} className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
                        <span className="text-blue-500 font-bold mt-0.5 flex-shrink-0">&#10003;</span>
                        <p className="text-sm text-gray-700 leading-relaxed">{hint}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* 면책 문구 */}
            <p className="text-xs text-gray-400 text-center leading-relaxed">
              본 서비스는 공개된 호가 데이터를 기반으로 한 정보 제공 서비스입니다.<br />
              실제 계약 조건은 층수, 권리금, 업종 제한, 시설 상태에 따라 달라질 수 있습니다.<br />
              데이터 기준일: 2025년 2월
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
