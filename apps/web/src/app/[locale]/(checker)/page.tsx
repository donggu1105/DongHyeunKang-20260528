'use client';

// MVP: 하드코딩된 한국어 문자열. PUBLIC 페이지(로그인 없음).
// 커머스 플로우: 상품 목록 → 결제 페이지(나이·합계) → 결제 직전 넛지 모달 → 완료.
import { useEffect, useState } from 'react';
import { formatKRW } from '@/components/checker/format';
import { NudgeModal } from '@/components/checker/NudgeModal';
import { PERSONA_SCENARIOS } from '@/components/checker/personaScenarios';
import type { PersonaScenario } from '@/components/checker/personaScenarios';
import { ProductPicker } from '@/components/checker/ProductPicker';
import { SetSection } from '@/components/checker/SetSection';
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
  const [selectedPersonaId, setSelectedPersonaId] = useState<string | null>(null);

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

  // 페르소나 선택 — 나이 프리필 + 해당 세트 섹션으로 스크롤·강조 (제품 자동 담기는 안 함)
  const selectPersona = (s: PersonaScenario) => {
    setSelectedPersonaId(s.id);
    if (s.ageYears !== null) {
      setAgeInput(String(s.ageYears));
    }
    // 클라이언트 핸들러 — 해당 세트 섹션으로 스크롤
    setTimeout(() => {
      document
        .querySelector(`#set-${s.id}`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
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
          <h1 className="text-2xl font-bold text-gray-900">levit - 아이 영양제</h1>
          <p className="text-sm text-gray-500">담고 결제 전에 안전까지 확인해 드려요</p>
        </button>
      </header>

      {view === 'shop' && (
        <>
          {catalogState === 'ready' && (
            <>
              {/* 페르소나 요약 — 고르면 나이 프리필 + 해당 세트로 스크롤·강조 */}
              <section className="mb-6">
                <h2 className="mb-1 font-semibold text-gray-900 text-sm">어떤 상황에 가까우세요?</h2>
                <p className="mb-3 text-gray-500 text-xs">
                  고르면 맞춤 세트로 안내하고 나이를 미리 채워 드려요.
                </p>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {PERSONA_SCENARIOS.filter((s) => s.setName).map((s) => (
                    <button
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-left transition ${
                        selectedPersonaId === s.id
                          ? 'border-blue-400 bg-blue-50/60'
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                      key={s.id}
                      onClick={() => {
                        selectPersona(s);
                      }}
                      type="button"
                    >
                      <span aria-hidden="true" className="text-2xl">
                        {s.emoji}
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold text-gray-900 text-sm">{s.title}</span>
                        <span className="block truncate text-gray-500 text-xs">{s.pain}</span>
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              {/* 세트 컬렉션 섹션들 */}
              <div className="mb-10 flex flex-col gap-10">
                {PERSONA_SCENARIOS.filter((s) => s.setName).map((s) => (
                  <SetSection
                    cart={cart}
                    highlighted={selectedPersonaId === s.id}
                    key={s.id}
                    onAddSet={addSet}
                    onToggle={toggleCart}
                    products={products}
                    scenario={s}
                  />
                ))}
              </div>
            </>
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
            <section>
              <h2 className="mb-3 font-bold text-gray-900 text-lg">전체 상품</h2>
              <ProductPicker onToggle={toggleCart} products={products} selectedIds={cart} />
            </section>
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

      {view === 'shop' && cart.length > 0 && (
        <button
          aria-label={`장바구니 ${cart.length}개 — 결제로`}
          className="fixed right-5 bottom-5 z-30 flex size-14 cursor-pointer items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition hover:bg-blue-700"
          onClick={() => {
            setView('checkout');
          }}
          type="button"
        >
          <svg
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.8}
            viewBox="0 0 24 24"
          >
            <path
              d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12A1.125 1.125 0 0119.748 21H4.252a1.125 1.125 0 01-1.121-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="-right-1 -top-1 absolute flex size-6 items-center justify-center rounded-full bg-red-500 font-bold text-xs">
            {cart.length}
          </span>
        </button>
      )}
    </main>
  );
}
