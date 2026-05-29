'use client';

import type { CatalogProduct } from '@/libs/Api';
import { ProductCard } from './ProductCard';

type Props = { products: CatalogProduct[]; selectedIds: number[]; onToggle: (id: number) => void };

export function ProductPicker({ products, selectedIds, onToggle }: Props) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.id}>
          <ProductCard product={p} selected={selectedIds.includes(p.id)} onToggle={onToggle} />
        </li>
      ))}
    </ul>
  );
}
