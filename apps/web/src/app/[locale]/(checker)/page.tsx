'use client';

// MVP: 하드코딩된 한국어 문자열. PUBLIC 페이지(로그인 없음).
// 커머스 플로우: 상품 목록 → 결제 페이지(나이·합계) → 결제 직전 넛지 모달 → 완료.
import { useEffect, useState } from 'react';
import { formatKRW } from '@/components/checker/format';
import { NudgeModal } from '@/components/checker/NudgeModal';
import { PERSONA_SCENARIOS } from '@/components/checker/personaScenarios';
import type { PersonaScenario } from '@/components/checker/personaScenarios';
import { ProductPicker } from '@/components/checker/ProductPicker';
import type { CatalogProduct } from '@/libs/Api';
import { getProducts } from '@/libs/Api';

type View = 'shop' | 'checkout' | 'done';

export default function CheckPage() {
  const [view, setView] = useState<View>('shop');
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [cart, setCart] = useState<number[]>([]);
  const [ageInput, setAgeInput] = useState('');
  const [nudgeOpen, setNudgeOpen] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await getProducts();
        if (active) {
          setProducts(data);
          setCatalogState('ready');
        }
      } catch {
        if (active) {
          setCatalogState('error');
        }
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);

  const cartProducts = products.filter((p) => cart.includes(p.id));
  const total = cartProducts.reduce((sum, p) => sum + (p.price ?? 0), 0);

  const toggleCart = (id: number) => {
    setCart((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const removeFromCart = (id: number) => {
    setCart((prev) => prev.filter((x) => x !== id));
  };

  // 추천 세트 빠른 담기 (페르소나 프리셋: 이름→id)
  const addSet = (s: PersonaScenario) => {
    const ids = s.productNames
      .map((n) => products.find((p) => p.name === n)?.id)
      .filter((x): x is number => x !== undefined);
    setCart((prev) => [...new Set([...prev, ...ids])]);
    if (s.ageYears !== null) {
      setAgeInput(String(s.ageYears));
    }
  };

  const ageYears = ageInput.trim() === '' ? null : Number(ageInput);
  const ageValid = ageYears !== null && !Number.isNaN(ageYears) && ageYears >= 0 && ageYears <= 18;
  // 모달에 number 프롭으로 넘기기 위한 정규화 (ageValid일 때만 사용)
  const childAge = ageValid ? ageYears : 0;

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 pb-12 text-gray-800">
      <header className="mb-6 flex items-center justify-between gap-3">
        <button
          className="cursor-pointer text-left"
          onClick={() => {
            setView('shop');
          }}
          type="button"
        >
          <h1 className="text-2xl font-bold text-gray-900">키즈 영양제 스토어</h1>
          <p className="text-sm text-gray-500">담고 결제 전에 안전까지 확인해 드려요</p>
        </button>
        {view === 'shop' && (
          <button
            className="relative shrink-0 cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            disabled={cart.length === 0}
            onClick={() => {
              setView('checkout');
            }}
            type="button"
          >
            장바구니 {cart.length > 0 ? `(${cart.length})` : ''}
          </button>
        )}
      </header>

      {view === 'shop' && (
        <>
          {/* 추천 세트 빠른 담기 */}
          {catalogState === 'ready' && (
            <section className="mb-6">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">이런 세트는 어때요?</h2>
              <div className="flex flex-wrap gap-2">
                {PERSONA_SCENARIOS.filter((s) => s.setName).map((s) => (
                  <button
                    className="cursor-pointer rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 transition hover:bg-blue-100"
                    key={s.id}
                    onClick={() => {
                      addSet(s);
                    }}
                    type="button"
                  >
                    {s.emoji} {s.setName} +{s.productNames.length}
                  </button>
                ))}
              </div>
            </section>
          )}

          {catalogState === 'loading' && (
            <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">제품을 불러오는 중…</p>
          )}
          {catalogState === 'error' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-semibold">제품 목록을 불러오지 못했습니다.</p>
              <p className="mt-1 text-red-600">API 서버 확인 (로컬: http://localhost:3001).</p>
            </div>
          )}
          {catalogState === 'ready' && (
            <ProductPicker onToggle={toggleCart} products={products} selectedIds={cart} />
          )}

          {/* 하단 고정 카트 요약 */}
          {cart.length > 0 && (
            <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white/95 backdrop-blur">
              <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">담은 제품 {cart.length}개</p>
                  <p className="text-xs text-gray-500">합계 {formatKRW(total)}</p>
                </div>
                <button
                  className="shrink-0 cursor-pointer rounded-lg bg-blue-600 px-5 py-2 text-base font-semibold text-white transition hover:bg-blue-700"
                  onClick={() => {
                    setView('checkout');
                  }}
                  type="button"
                >
                  장바구니 보기 →
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {view === 'checkout' && (
        <div className="mx-auto max-w-2xl">
          <button
            className="mb-4 cursor-pointer text-sm font-semibold text-blue-700 hover:underline"
            onClick={() => {
              setView('shop');
            }}
            type="button"
          >
            ← 계속 쇼핑하기
          </button>
          <h2 className="mb-4 text-xl font-bold text-gray-900">장바구니 · 결제</h2>

          {cart.length === 0 ? (
            <p className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">담은 제품이 없어요.</p>
          ) : (
            <>
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {cartProducts.map((p) => (
                  <li className="flex items-center gap-3 p-3" key={p.id}>
                    <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-gray-50">
                      {/* 작은 썸네일 (일반 img로 충분) */}
                      {p.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt={p.name} className="size-full object-contain" src={p.imageUrl} />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{p.name}</p>
                      <p className="text-sm text-gray-500">{formatKRW(p.price)}</p>
                    </div>
                    <button
                      className="shrink-0 cursor-pointer text-sm text-gray-400 hover:text-red-600"
                      onClick={() => {
                        removeFromCart(p.id);
                      }}
                      type="button"
                    >
                      삭제
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-4 flex items-center justify-between text-lg font-bold text-gray-900">
                <span>합계</span>
                <span>{formatKRW(total)}</span>
              </div>

              <div className="mt-6 rounded-xl border border-gray-200 p-4">
                <label className="text-sm font-semibold text-gray-900" htmlFor="age">
                  아이 나이 <span className="text-red-500">*</span>
                </label>
                <p className="mt-0.5 text-xs text-gray-500">
                  안전 확인에 필요해요 (만 나이, 0~18).
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    aria-label="아이 나이 (만 나이)"
                    className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
                    id="age"
                    inputMode="numeric"
                    max={18}
                    min={0}
                    onChange={(e) => {
                      setAgeInput(e.target.value);
                    }}
                    placeholder="예: 5"
                    type="number"
                    value={ageInput}
                  />
                  <span className="text-base text-gray-600">세</span>
                </div>
              </div>

              <button
                className="mt-6 w-full cursor-pointer rounded-lg bg-blue-600 px-5 py-3 text-lg font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!ageValid}
                onClick={() => {
                  setNudgeOpen(true);
                }}
                type="button"
              >
                {formatKRW(total)} 결제하기
              </button>
              {!ageValid && (
                <p className="mt-2 text-center text-xs text-gray-400">
                  결제하려면 아이 나이를 입력해 주세요.
                </p>
              )}
            </>
          )}
        </div>
      )}

      {view === 'done' && (
        <div className="mx-auto max-w-md py-16 text-center">
          <p className="text-5xl">🎉</p>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">결제 완료 (데모)</h2>
          <p className="mt-2 text-gray-600">
            안전 확인까지 마친 주문이에요. 실제 결제는 일어나지 않습니다.
          </p>
          <button
            className="mt-6 cursor-pointer rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white transition hover:bg-blue-700"
            onClick={() => {
              setCart([]);
              setAgeInput('');
              setView('shop');
            }}
            type="button"
          >
            처음으로
          </button>
        </div>
      )}

      {nudgeOpen && ageValid && (
        <NudgeModal
          ageYears={childAge}
          onAdjust={() => {
            setNudgeOpen(false);
            setView('shop');
          }}
          onClose={() => {
            setNudgeOpen(false);
          }}
          onConfirmPay={() => {
            setNudgeOpen(false);
            setView('done');
          }}
          productIds={cart}
        />
      )}
    </main>
  );
}
