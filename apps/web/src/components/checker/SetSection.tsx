'use client';

import type { CatalogProduct } from '@/libs/Api';
import { formatKRW } from './format';
import type { PersonaScenario } from './personaScenarios';
import { ProductCard } from './ProductCard';

type Props = {
  scenario: PersonaScenario;
  products: CatalogProduct[]; // 전체 카탈로그 (이름→제품 해석용)
  cart: number[];
  onToggle: (id: number) => void;
  onAddSet: (s: PersonaScenario) => void;
};

export function SetSection({ scenario, products, cart, onToggle, onAddSet }: Props) {
  const setProducts = scenario.productNames
    .map((n) => products.find((p) => p.name === n))
    .filter((p): p is CatalogProduct => p !== undefined);
  if (setProducts.length === 0) {
    return null;
  }
  const total = setProducts.reduce((sum, p) => sum + (p.price ?? 0), 0);
  const productHero = setProducts.find((p) => p.imageUrl)?.imageUrl ?? null;
  // 세트 전용 배너(배지·헤드라인·나이가 이미지에 내장) 우선, 없으면 첫 제품 사진
  const heroBanner = scenario.heroImage ?? null;
  const allInCart = setProducts.every((p) => cart.includes(p.id));

  return (
    <section
      className="scroll-mt-6 rounded-2xl"
      id={`set-${scenario.id}`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        {/* 배너에 헤드라인이 내장된 세트는 짧은 라벨, 아니면 엄마 관점 설득 헤드라인 */}
        <h2 className="font-bold text-gray-900 text-lg">
          <span aria-hidden="true">{scenario.emoji}</span>{' '}
          {heroBanner ? scenario.setName : (scenario.headline ?? scenario.setName)}
        </h2>
        {scenario.ageYears !== null && (
          <span className="shrink-0 text-gray-500 text-sm">만 {scenario.ageYears}세 추천</span>
        )}
      </div>

      {heroBanner ? (
        // 세트 전용 배너: 배지·헤드라인·나이가 이미지에 내장 → 오버레이 생략, 액션만 아래에
        <div className="mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={scenario.headline ?? scenario.setName}
            className="w-full rounded-2xl"
            src={heroBanner}
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-gray-600">
              {setProducts.length}개 구성 · {formatKRW(total)}
            </p>
            <button
              className="shrink-0 cursor-pointer rounded-lg bg-blue-600 px-4 py-2 font-bold text-white text-sm transition hover:bg-blue-700"
              onClick={() => {
                onAddSet(scenario);
              }}
              type="button"
            >
              {allInCart ? '담음 ✓' : '이 세트 담기'}
            </button>
          </div>
        </div>
      ) : (
        <div className="relative mb-4 h-44 w-full overflow-hidden rounded-2xl bg-gray-200">
          {productHero ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="absolute inset-0 size-full object-cover" src={productHero} />
          ) : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white">
            <div className="mb-2 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/20 px-2.5 py-1 font-semibold text-xs backdrop-blur">
                🛡 중복·과다 0 검증
              </span>
              <span className="rounded-full bg-white/20 px-2.5 py-1 font-semibold text-xs backdrop-blur">
                ⏱ 한 번에 담기
              </span>
            </div>
            <p className="font-bold text-xl">{scenario.setName}</p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="text-sm text-white/90">
                {setProducts.length}개 구성 · {formatKRW(total)}
              </p>
              <button
                className="shrink-0 cursor-pointer rounded-lg bg-white px-4 py-2 font-bold text-blue-700 text-sm transition hover:bg-blue-50"
                onClick={() => {
                  onAddSet(scenario);
                }}
                type="button"
              >
                {allInCart ? '담음 ✓' : '이 세트 담기'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {setProducts.map((p) => (
          <li key={p.id}>
            <ProductCard onToggle={onToggle} product={p} selected={cart.includes(p.id)} />
          </li>
        ))}
      </ul>
    </section>
  );
}
