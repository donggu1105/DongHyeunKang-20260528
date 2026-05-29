'use client';

type Props = {
  count: number;
  previewNames: string[];
  ctaLabel: string;
  onCta: () => void;
  disabled?: boolean;
};

export function StickyCartBar({ count, previewNames, ctaLabel, onCta, disabled }: Props) {
  if (count === 0) {
    return null;
  }
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-gray-200 border-t bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 text-sm">담은 제품 {count}개</p>
          <p className="truncate text-gray-500 text-xs">{previewNames.join(', ')}</p>
        </div>
        <button
          className="shrink-0 cursor-pointer rounded-lg bg-blue-600 px-5 py-2 font-semibold text-base text-white transition hover:bg-blue-700 disabled:opacity-60"
          disabled={disabled}
          onClick={onCta}
          type="button"
        >
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}
