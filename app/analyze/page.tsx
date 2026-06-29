'use client'

import { useState } from 'react'
import { AnalyzeResult } from '@/types'

export default function AnalyzePage() {
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<AnalyzeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

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

            {/* 층별 요약 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-700 mb-4">층별 평단가 비교</h2>
              <div className="space-y-3">
                {result.byFloor.map(floor => (
                  <div key={floor.floorType} className="flex items-center gap-4">
                    <span className="text-xs font-medium text-gray-500 w-12">{floor.floorType}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-2 rounded-full"
                        style={{ width: `${Math.min((floor.avgPrice / 30) * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-800 w-20 text-right">
                      {floor.avgPrice}만원/평
                    </span>
                    <span className="text-xs text-gray-400 w-12 text-right">{floor.count}개</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 상세 리포트 잠금 */}
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm relative overflow-hidden">
              <div className="absolute inset-0 bg-white/70 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                <span className="text-3xl mb-2">🔒</span>
                <p className="font-semibold text-gray-700 mb-1">상세 리포트</p>
                <p className="text-sm text-gray-500 mb-4 text-center">비교 매물 리스트, 실거래 사례,<br />협상 포인트가 포함됩니다.</p>
                <button className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium opacity-50 cursor-not-allowed">
                  상세 리포트 열람하기 (준비중)
                </button>
              </div>
              <div className="space-y-2 opacity-30 select-none">
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
                <div className="h-4 bg-gray-200 rounded w-2/3" />
                <div className="h-4 bg-gray-200 rounded w-3/4" />
                <div className="h-4 bg-gray-200 rounded w-1/2" />
              </div>
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
