'use client';

import Image from 'next/image';
import type { CatalogProduct } from '@/libs/Api';
import { discountPercent, formatKRW } from './format';

type Props = { product: CatalogProduct; selected: boolean; onToggle: (id: number) => void };

export function ProductCard({ product, selected, onToggle }: Props) {
  const list = formatKRW(product.listPrice);
  const sale = formatKRW(product.price);
  const off = discountPercent(product.listPrice, product.price);

  return (
    <button
      type="button"
      onClick={() => {
        onToggle(product.id);
      }}
      aria-pressed={selected}
      className={`group flex w-full cursor-pointer flex-col overflow-hidden rounded-2xl border text-left transition duration-200 ${
        selected
          ? 'border-blue-500 ring-2 ring-blue-200'
          : 'border-gray-200 hover:border-blue-300 hover:shadow-md'
      }`}
    >
      <div className="relative aspect-square w-full bg-gradient-to-br from-blue-50 to-indigo-50">
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
        {list && off !== null && <p className="text-sm text-gray-400 line-through">{list}</p>}
        <p className="flex flex-wrap items-baseline gap-x-2">
          {sale && (
            <span className="whitespace-nowrap font-bold text-gray-900 text-lg">{sale}</span>
          )}
          {off !== null && (
            <span className="whitespace-nowrap font-bold text-red-600 text-sm">{off}%</span>
          )}
        </p>
        <div className="mt-1 flex flex-wrap gap-1 text-xs text-gray-500">
          {product.form && <span className="rounded bg-gray-100 px-2 py-0.5">{product.form}</span>}
          {product.targetAgeLabel && (
            <span className="rounded bg-gray-100 px-2 py-0.5">{product.targetAgeLabel}</span>
          )}
        </div>
        <span
          className={`mt-2 inline-flex w-fit rounded-md px-2 py-1 text-sm font-medium ${
            selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
          }`}
        >
          {selected ? '✓ 담음' : '담기'}
        </span>
      </div>
    </button>
  );
}
