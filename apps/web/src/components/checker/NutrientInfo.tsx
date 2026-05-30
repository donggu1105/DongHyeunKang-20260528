'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useIngredients } from '@/hooks/useIngredients';
import { formatIuHelper, NUTRIENT_ROLE } from './nutrientFacts';

type Props = {
  ingredientName: string;
  ageMonths?: number | null;
  children: ReactNode;
  /** 🔍 마커 노출 여부. 카드처럼 성분이 많아 아이콘이 시각적으로 시끄러운 곳은 false(점선 밑줄만). */
  showIcon?: boolean;
};

export function NutrientInfo({ ingredientName, ageMonths, children, showIcon = true }: Props) {
  const state = useIngredients();
  const [open, setOpen] = useState(false);
  // 팝오버는 document.body로 포탈된다(아래) — ProductCard 카드(<button overflow-hidden>)와
  // 모달(overflow-hidden/overflow-y-auto) 같은 조상에 'position:absolute'가 잘리는 걸 피하려고.
  // 그래서 트리거의 화면 좌표를 재서 'position:fixed'로 띄운다.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popoverId = useId();

  // 열려 있는 동안 스크롤/리사이즈되면 fixed 좌표가 어긋나므로 닫는다(가장 안전).
  useEffect(() => {
    if (!open) {
      return;
    }
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [open]);

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

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  // 트리거→팝오버로 마우스가 건너가는 짧은 빈틈을 메우는 닫기 지연.
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };
  // 트리거 위치를 재서 fixed 좌표를 잡고 연다.
  const doOpen = () => {
    cancelClose();
    const r = wrapperRef.current?.getBoundingClientRect();
    if (r) {
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen(true);
  };
  const toggle = () => {
    if (open) {
      setOpen(false);
    } else {
      doOpen();
    }
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      // Keyboard activation mirrors the click toggle for role=button parity.
      e.preventDefault();
      e.stopPropagation();
      toggle();
    }
  };

  return (
    <span
      className="inline-flex items-center gap-0.5"
      onBlur={(e) => {
        // 포커스가 트리거·팝오버 어느 쪽에도 안 남을 때만 닫는다 — 팝오버 안 출처 링크 접근 보장.
        const rt = e.relatedTarget as Node | null;
        if (!(wrapperRef.current?.contains(rt) || popoverRef.current?.contains(rt))) {
          setOpen(false);
        }
      }}
      onFocus={doOpen}
      onMouseEnter={doOpen}
      // mouseLeave는 마우스 hover 전용 닫기다(팝오버 onMouseEnter가 빈틈을 메운다). 키보드는 focus/blur가 담당.
      onMouseLeave={scheduleClose}
      ref={wrapperRef}
    >
      {/* Span, not <button>: ProductCard wraps the whole card in a <button>; nested buttons are invalid HTML / an a11y violation, so a real <button> here is intentionally avoided. */}
      {/* oxlint-disable jsx-a11y/prefer-tag-over-role */}
      <span
        aria-describedby={open ? popoverId : undefined}
        className="inline-flex cursor-help items-center gap-0.5 underline decoration-dotted underline-offset-2"
        onClick={(e) => {
          e.stopPropagation();
          toggle();
        }}
        onKeyDown={onKeyDown}
        role="button"
        tabIndex={0}
      >
        {children}
        {/* data-testid sits on this small marker (not the wide trigger span) on purpose:
            an inline role=button span only hit-tests on its glyph pixels, so a Playwright
            click on the wide span lands in inter-glyph leading owned by the parent <button>
            (flaky). This fully-filled marker is a reliable click target, and the testid keeps
            the test decoupled from the 🔍 emoji character (survives an icon swap). */}
        {showIcon && (
          <span
            aria-hidden="true"
            className="text-xs opacity-60"
            data-testid="nutrient-info-trigger"
          >
            🔍
          </span>
        )}
      </span>
      {/* oxlint-enable jsx-a11y/prefer-tag-over-role */}

      {open &&
        pos &&
        createPortal(
          <div
            className="fixed z-50 w-60 rounded-xl border border-gray-200 bg-white p-3 text-left shadow-lg"
            id={popoverId}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            ref={popoverRef}
            role="tooltip"
            style={{ left: pos.left, top: pos.top }}
          >
            <p className="flex items-center justify-between gap-2 text-sm font-semibold text-gray-900">
              <span>{ingredientName}</span>
              {role && <span className="text-xs font-normal text-gray-500">{role}</span>}
            </p>

            {iuHelper && (
              <p className="mt-1 rounded bg-blue-50 px-2 py-1 text-xs text-blue-700">
                💊 {iuHelper}
              </p>
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
          </div>,
          document.body,
        )}
    </span>
  );
}
