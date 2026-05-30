'use client';

import Image from 'next/image';
import type { CatalogProduct } from '@/libs/Api';
import { discountPercent, formatKRW, getMfdsInfo } from './format';
import { MfdsSeal } from './MfdsSeal';
import { NutrientInfo } from './NutrientInfo';

type Props = { product: CatalogProduct; selected: boolean; onToggle: (id: number) => void };

export function ProductCard({ product, selected, onToggle }: Props) {
  const sale = formatKRW(product.price);
  const list = formatKRW(product.listPrice);
  const off = discountPercent(product.listPrice, product.price);
  const mfds = getMfdsInfo(product.sourceUrl);
  // 카드의 본문은 가격이 아니라 "어떤 영양소가 얼마나 들었나" — 페르소나가 중복·과다를
  // 걱정하는 그 정보다. 상위 3종만 보이고 나머지는 개수로 접는다.
  const keyIngredients = product.ingredients.slice(0, 3);
  const moreCount = product.ingredients.length - keyIngredients.length;

  return (
    <button
      type="button"
      onClick={() => {
        onToggle(product.id);
      }}
      aria-pressed={selected}
      className={`group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-2xl border text-left transition duration-200 ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
      }`}
    >
      <div className="relative aspect-square w-full bg-gradient-to-br from-blue-50 to-indigo-50">
        {mfds && <MfdsSeal statementNo={mfds.statementNo} />}
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="(max-width:640px) 50vw, 25vw"
            className="object-contain p-4"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-300">
            이미지 없음
          </div>
        )}
        <span
          aria-hidden="true"
          className={`absolute right-2 bottom-2 flex size-9 items-center justify-center rounded-full shadow-sm transition-colors ${
            selected ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 group-hover:text-blue-600'
          }`}
        >
          <svg
            className="size-5"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.8}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12A1.125 1.125 0 0119.748 21H4.252a1.125 1.125 0 01-1.121-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007z"
            />
          </svg>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="line-clamp-2 min-h-[2.5rem] font-semibold text-gray-900">{product.name}</p>
        {keyIngredients.length > 0 && (
          <ul className="min-h-[4.5rem] space-y-0.5 text-sm">
            {/* 성분명 + 함량을 한 덩어리로 ("비타민D 25㎍"). 카드엔 🔍를 빼고(showIcon=false)
                점선 밑줄만 — 성분이 많아 아이콘이 시각적으로 시끄러웠음. */}
            {keyIngredients.map((ing) => (
              <li className="flex items-baseline justify-end gap-1 text-gray-500" key={ing.name}>
                <NutrientInfo ingredientName={ing.name} showIcon={false}>
                  {ing.name}
                </NutrientInfo>
                <span className="font-medium text-gray-800">
                  {ing.amount}
                  {ing.unit}
                </span>
              </li>
            ))}
            {moreCount > 0 && (
              <li className="text-right text-xs text-gray-400">외 {moreCount}종</li>
            )}
          </ul>
        )}
        <div className="mt-auto pt-2">
          {/* 가격 — 커머스형 할인 표시 */}
          {list && off !== null && <p className="text-xs text-gray-400 line-through">{list}</p>}
          <p className="flex items-baseline gap-1.5">
            {sale && (
              <span className="text-base font-bold whitespace-nowrap text-gray-900">{sale}</span>
            )}
            {off !== null && (
              <span className="text-sm font-bold whitespace-nowrap text-red-500">{off}%</span>
            )}
          </p>
          {/* 제형 / 연령 */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-xs text-gray-500">
            {product.form && (
              <span className="rounded bg-gray-100 px-2 py-0.5">{product.form}</span>
            )}
            {product.targetAgeLabel && (
              <span className="rounded bg-gray-100 px-2 py-0.5">{product.targetAgeLabel}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
