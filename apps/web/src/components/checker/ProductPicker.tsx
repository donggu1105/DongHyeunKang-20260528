'use client';

// MVP: 하드코딩된 한국어 문자열 (i18n 메시지 카탈로그 미사용 — 데모용 단순화)
import type { CatalogProduct } from '@/libs/Api';

type ProductPickerProps = {
  products: CatalogProduct[];
  selectedIds: number[];
  onToggle: (id: number) => void;
};

export function ProductPicker({ products, selectedIds, onToggle }: ProductPickerProps) {
  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {products.map((product) => {
        const selected = selectedIds.includes(product.id);
        return (
          <li key={product.id}>
            <button
              type="button"
              onClick={() => onToggle(product.id)}
              aria-pressed={selected}
              className={`flex w-full flex-col gap-2 rounded-xl border p-4 text-left transition ${
                selected
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-gray-900">{product.name}</p>
                  {product.brand && <p className="text-sm text-gray-500">{product.brand}</p>}
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${
                    selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {selected ? '✓ 담음' : '담기'}
                </span>
              </div>

              <div className="flex flex-wrap gap-1 text-xs text-gray-500">
                {product.form && (
                  <span className="rounded bg-gray-100 px-2 py-0.5">{product.form}</span>
                )}
                {product.targetAgeLabel && (
                  <span className="rounded bg-gray-100 px-2 py-0.5">{product.targetAgeLabel}</span>
                )}
              </div>

              {product.ingredients.length > 0 && (
                <p className="text-xs text-gray-500">
                  {product.ingredients
                    .slice(0, 4)
                    .map((i) => i.name)
                    .join(' · ')}
                  {product.ingredients.length > 4 ? ' …' : ''}
                </p>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
