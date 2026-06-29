import Link from 'next/link'

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Hero */}
      <section className="bg-gray-900 text-white py-24 px-4 text-center">
        <h1 className="text-3xl md:text-5xl font-bold leading-tight mb-4">
          상가 계약 전에,<br />
          이 월세가 비싼지<br />
          먼저 확인하세요.
        </h1>
        <p className="text-gray-400 text-lg mb-8">
          반경 500m 내 상가 시세와 비교해드립니다.
        </p>
        <Link
          href="/analyze"
          className="inline-block bg-blue-500 hover:bg-blue-400 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-colors"
        >
          무료로 주소 검색하기
        </Link>
      </section>

      {/* Problem */}
      <section className="py-20 px-4 max-w-3xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">
          초보 창업자가 상가 계약 전<br />가장 많이 하는 실수
        </h2>
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { emoji: '🤷', title: '비교 기준이 없다', desc: '중개사가 "싸다"고 해도 실제로 주변 시세가 얼마인지 알 방법이 없다.' },
            { emoji: '📋', title: '권리금만 본다', desc: '권리금이 낮아도 월세가 높으면 오히려 손해인 구조를 놓친다.' },
            { emoji: '💸', title: '월세 감당 계산 안 한다', desc: '월세 250만원이면 최소 얼마 팔아야 남는지 계산 없이 계약한다.' },
          ].map(item => (
            <div key={item.title} className="text-center">
              <div className="text-4xl mb-3">{item.emoji}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="bg-gray-50 py-20 px-4">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 text-center mb-12">이렇게 사용하세요</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', title: '주소 입력', desc: '고민 중인 상가 주소를 입력합니다.' },
              { step: '02', title: '반경 500m 분석', desc: '주변 매물의 월세·평단가를 자동 분석합니다.' },
              { step: '03', title: '결과 확인', desc: '주변 대비 비싼지 저렴한지 즉시 확인합니다.' },
            ].map(item => (
              <div key={item.step} className="flex flex-col items-center text-center">
                <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center mb-4 text-lg">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-gray-500 text-sm">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">
          지금 바로 주소를 입력하고<br />확인해보세요
        </h2>
        <p className="text-gray-500 mb-8">무료로 주변 시세를 확인할 수 있습니다.</p>
        <Link
          href="/analyze"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold px-8 py-4 rounded-xl text-lg transition-colors"
        >
          무료 분석 시작하기
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 py-8 px-4 text-center">
        <p className="text-xs text-gray-400 leading-relaxed">
          본 서비스는 공개된 호가 데이터를 기반으로 한 정보 제공 서비스입니다.<br />
          실제 계약 조건은 층수, 권리금, 업종 제한, 시설 상태에 따라 달라질 수 있습니다.
        </p>
      </footer>
    </main>
  )
}
