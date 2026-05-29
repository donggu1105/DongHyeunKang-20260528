'use client';

// MVP: 하드코딩된 한국어 문자열 (i18n 메시지 카탈로그 미사용 — 데모용 단순화).
// PUBLIC 페이지: (checker) 라우트 그룹에는 ClerkProvider가 없어 로그인 없이 접근 가능.
import { useEffect, useState } from 'react';
import { AgeStep } from '@/components/checker/AgeStep';
import { PersonaLanding } from '@/components/checker/PersonaLanding';
import type { PersonaScenario } from '@/components/checker/personaScenarios';
import { ProductPicker } from '@/components/checker/ProductPicker';
import { RecommendedSetCard } from '@/components/checker/RecommendedSetCard';
import { ReportCard } from '@/components/checker/ReportCard';
import type { AnalyzeResponse, CatalogProduct } from '@/libs/Api';
import { analyze, ApiError, getProducts } from '@/libs/Api';

export default function CheckPage() {
  // 진입 상태: 페르소나 랜딩 ↔ 체커. 랜딩은 기존 체커 위에 얹은 데모 레이어다.
  const [entry, setEntry] = useState<'landing' | 'checker'>('landing');
  const [persona, setPersona] = useState<PersonaScenario | null>(null);

  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'error'>('loading');

  const [cart, setCart] = useState<number[]>([]);
  const [ageYears, setAgeYears] = useState<number | null>(null);

  const [report, setReport] = useState<AnalyzeResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // "추가하기" (선택 단계) 패널 노출 여부
  const [showAddMore, setShowAddMore] = useState(false);

  useEffect(() => {
    let active = true;
    getProducts()
      .then((data) => {
        if (active) {
          setProducts(data);
          setCatalogState('ready');
        }
      })
      .catch(() => {
        if (active) {
          setCatalogState('error');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  // 페르소나 선택 → 나이·장바구니 프리필 후 체커로 진입.
  // 프리셋은 제품 "이름"으로 지정 — 카탈로그에서 id로 해석하고, 없는 이름은 건너뛰고 경고한다.
  const handlePersonaSelect = (scenario: PersonaScenario) => {
    const ids: number[] = [];
    for (const name of scenario.productNames) {
      const found = products.find((p) => p.name === name);
      if (found) {
        ids.push(found.id);
      } else {
        console.warn(`[persona] 카탈로그에 없는 제품이라 건너뜁니다: ${name}`);
      }
    }
    setPersona(scenario);
    setCart(ids);
    setReport(null);
    setAnalyzeError(null);
    setShowAddMore(false);
    setEntry('checker');
  };

  // 랜딩으로 복귀 — 상태 초기화
  const backToLanding = () => {
    setEntry('landing');
    setPersona(null);
    setCart([]);
    setAgeYears(null);
    setReport(null);
    setAnalyzeError(null);
    setShowAddMore(false);
  };

  const toggleCart = (id: number) => {
    setCart((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    // 카트가 바뀌면 이전 결과는 무효 — 재분석 유도
    setReport(null);
    setAnalyzeError(null);
  };

  const runAnalyze = async (years: number) => {
    setAgeYears(years);
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await analyze({
        ageMonths: Math.round(years * 12),
        productIds: cart,
      });
      setReport(result);
    } catch (err) {
      setAnalyzeError(
        err instanceof ApiError ? err.message : '분석 중 오류가 발생했습니다. 다시 시도해 주세요.',
      );
    } finally {
      setAnalyzing(false);
    }
  };

  // "추가하기" 후 재분석 (이미 나이를 알고 있으므로 입력 없이 바로)
  const reAnalyze = () => {
    if (ageYears !== null) {
      runAnalyze(ageYears);
    }
  };

  const cartProducts = products.filter((p) => cart.includes(p.id));

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 text-gray-800">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">우리 아이 영양제 안전 체크</h1>
        <p className="mt-2 text-base text-gray-600">
          먹이는 영양제를 담고 아이 나이만 입력하면, 중복·과다 섭취 위험을 근거와 함께 확인해
          드려요. 5분이면 충분합니다.
        </p>
      </header>

      {entry === 'landing' ? (
        <PersonaLanding onSelect={handlePersonaSelect} />
      ) : (
        <>
          {/* 맥락 배너: 어떤 상황으로 들어왔는지 + 랜딩으로 복귀 */}
          <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border border-blue-100 bg-blue-50/60 px-4 py-3">
            <p className="text-sm text-gray-700">
              {persona && persona.id !== 'manual' ? (
                <>
                  <span aria-hidden="true">{persona.emoji}</span>{' '}
                  <strong className="font-semibold text-gray-900">{persona.title}</strong>
                  {persona.ageYears !== null && ` · 만 ${persona.ageYears}세 예시로 담았어요`}
                </>
              ) : (
                '직접 담아 확인하기'
              )}
            </p>
            <button
              type="button"
              onClick={backToLanding}
              className="shrink-0 cursor-pointer text-sm font-semibold text-blue-700 hover:underline"
            >
              상황 다시 고르기
            </button>
          </div>

          {/* 1) 카탈로그 */}
          <section className="mb-8">
            <h2 className="mb-3 text-xl font-semibold text-gray-900">
              1. 먹이는 영양제를 담아주세요
            </h2>

            {catalogState === 'loading' && (
              <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
                제품을 불러오는 중…
              </p>
            )}

            {catalogState === 'error' && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                <p className="font-semibold">제품 목록을 불러오지 못했습니다.</p>
                <p className="mt-1 text-red-600">
                  API 서버가 실행 중인지 확인해 주세요 (로컬: http://localhost:3001).
                </p>
              </div>
            )}

            {catalogState === 'ready' && (
              <ProductPicker products={products} selectedIds={cart} onToggle={toggleCart} />
            )}
          </section>

          {/* 2) 트리거: 카트에 1개 이상 담기면 나이 입력 노출 */}
          {cart.length > 0 && (
            <section className="mb-8 rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
              <p className="mb-3 text-sm text-gray-600">
                담은 제품 <strong>{cart.length}개</strong>:{' '}
                {cartProducts.map((p) => p.name).join(', ')}
              </p>
              <AgeStep
                onSubmit={runAnalyze}
                loading={analyzing}
                initialYears={persona?.ageYears ?? null}
              />
            </section>
          )}

          {/* 분석 에러 */}
          {analyzeError && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {analyzeError}
            </div>
          )}

          {/* 3) 리포트 */}
          {report && ageYears !== null && (
            <section className="mb-8">
              <h2 className="mb-3 text-xl font-semibold text-gray-900">분석 결과</h2>

              <RecommendedSetCard report={report} ageYears={ageYears} />
              <div className="mt-4">
                <ReportCard report={report} />
              </div>

              {/* 선택 단계 (차별점): 다른 영양제 추가 → 재분석 */}
              <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-5">
                {showAddMore ? (
                  <>
                    <h3 className="mb-3 text-base font-semibold text-gray-900">
                      추가로 먹는 영양제를 담아주세요
                    </h3>
                    <ProductPicker products={products} selectedIds={cart} onToggle={toggleCart} />
                    <button
                      type="button"
                      onClick={reAnalyze}
                      disabled={analyzing}
                      className="mt-4 rounded-lg bg-blue-600 px-5 py-2 text-base font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
                    >
                      {analyzing ? '다시 분석 중…' : '추가해서 다시 확인하기'}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowAddMore(true)}
                    className="text-base font-semibold text-blue-700 hover:underline"
                  >
                    ➕ 다른 영양제도 먹고 있나요? 추가하기
                  </button>
                )}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
