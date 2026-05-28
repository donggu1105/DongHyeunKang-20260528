'use client';

// MVP: 하드코딩된 한국어 문자열 (i18n 메시지 카탈로그 미사용 — 데모용 단순화).
// PUBLIC 페이지: (checker) 라우트 그룹에는 ClerkProvider가 없어 로그인 없이 접근 가능.
import { useEffect, useState } from 'react';
import { AgeStep } from '@/components/checker/AgeStep';
import { ProductPicker } from '@/components/checker/ProductPicker';
import { RecommendedSetCard } from '@/components/checker/RecommendedSetCard';
import { ReportCard } from '@/components/checker/ReportCard';
import type { AnalyzeResponse, CatalogProduct } from '@/libs/Api';
import { analyze, ApiError, getProducts } from '@/libs/Api';

export default function CheckPage() {
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

      {/* 1) 카탈로그 */}
      <section className="mb-8">
        <h2 className="mb-3 text-xl font-semibold text-gray-900">
          1. 먹이는 영양제를 담아주세요
        </h2>

        {catalogState === 'loading' && (
          <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">제품을 불러오는 중…</p>
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
          <AgeStep onSubmit={runAnalyze} loading={analyzing} />
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
    </main>
  );
}
