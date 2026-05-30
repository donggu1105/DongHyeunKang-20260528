'use client';

import { useId, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { useIngredients } from '@/hooks/useIngredients';
import { formatIuHelper, NUTRIENT_ROLE } from './nutrientFacts';

type Props = {
  ingredientName: string;
  ageMonths?: number | null;
  children: ReactNode;
};

export function NutrientInfo({ ingredientName, ageMonths, children }: Props) {
  const state = useIngredients();
  const [open, setOpen] = useState(false);
  const popoverId = useId();

  const info = state.status === 'ready' ? state.byName.get(ingredientName) : undefined;

  // Graceful degrade: data not ready or non-canon name → plain text, no 돋보기.
  if (state.status !== 'ready' || !info) {
    return <span>{children}</span>;
  }

  const role = NUTRIENT_ROLE[ingredientName];
  // null/undefined ageMonths → browsing mode (no highlight).
  const childBand =
    ageMonths === null || ageMonths === undefined
      ? null
      : (info.references.find((r) => ageMonths >= r.ageMinMonths && ageMonths <= r.ageMaxMonths) ??
        null);
  const recommended = childBand?.recommended;
  const iuHelper =
    recommended === null || recommended === undefined
      ? null
      : formatIuHelper(ingredientName, recommended);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      // Keyboard activation mirrors the click toggle for role=button parity.
      e.preventDefault();
      e.stopPropagation();
      setOpen((v) => !v);
    }
  };

  return (
    // The hover-to-open is a progressive enhancement; keyboard users get the same
    // popover via focus + Esc on the inner role=button, so no key handler is needed here.
    <span
      className="relative inline-flex items-center gap-0.5"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {/* Span, not <button>: ProductCard wraps the whole card in a <button>; nested buttons are invalid HTML / an a11y violation, so a real <button> here is intentionally avoided. */}
      {/* oxlint-disable jsx-a11y/prefer-tag-over-role */}
      <span
        aria-describedby={open ? popoverId : undefined}
        aria-expanded={open}
        className="inline-flex cursor-help items-center gap-0.5 underline decoration-dotted underline-offset-2"
        onBlur={() => setOpen(false)}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        role="button"
        tabIndex={0}
      >
        {children}
        <span aria-hidden="true" className="text-xs opacity-60">
          🔍
        </span>
      </span>
      {/* oxlint-enable jsx-a11y/prefer-tag-over-role */}

      {open && (
        <div
          className="absolute top-full left-0 z-20 mt-1 w-60 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-lg"
          id={popoverId}
          role="tooltip"
        >
          <p className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-900">
            <span>{ingredientName}</span>
            {role && <span className="text-xs font-normal text-gray-500">{role}</span>}
          </p>

          {iuHelper && (
            <p className="mt-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">💊 {iuHelper}</p>
          )}

          {info.references.length === 0 ? (
            <p className="mt-2 text-xs text-gray-500">공식 기준이 없어 확인불가예요.</p>
          ) : (
            <table className="mt-2 w-full text-xs">
              <thead>
                <tr className="text-gray-400">
                  <th className="text-left font-normal">나이</th>
                  <th className="text-right font-normal">권장</th>
                  <th className="text-right font-normal">상한</th>
                </tr>
              </thead>
              <tbody>
                {info.references.map((r) => {
                  const isChild = childBand?.ageMinMonths === r.ageMinMonths;
                  return (
                    <tr
                      className={isChild ? 'font-bold text-gray-900' : 'text-gray-400'}
                      key={r.ageMinMonths}
                    >
                      <td className="text-left">
                        {isChild ? '▸ ' : ''}
                        {r.ageLabel}
                      </td>
                      <td className="text-right">
                        {r.recommended ?? '-'}
                        {r.unit}
                      </td>
                      <td className="text-right">
                        {r.upperLimit ?? '-'}
                        {r.unit}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          <p className="mt-2 text-[10px] text-gray-400">
            기준: {info.source}
            {info.sourceUrl && (
              <>
                {' · '}
                <a
                  className="text-blue-600 underline"
                  href={info.sourceUrl}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  출처
                </a>
              </>
            )}
          </p>
        </div>
      )}
    </span>
  );
}
