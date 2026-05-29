'use client';

// MVP: 하드코딩된 한국어 문자열 (i18n 메시지 카탈로그 미사용 — 데모용 단순화)
import { useState } from 'react';

type AgeStepProps = {
  // 분석 트리거: 만 나이(년) → 개월 변환은 페이지에서 수행
  onSubmit: (years: number) => void;
  loading: boolean;
  // 페르소나 프리필: 진입 시 입력란을 미리 채운다 (사용자가 그대로 제출하거나 수정)
  initialYears?: number | null;
};

export function AgeStep({ onSubmit, loading, initialYears }: AgeStepProps) {
  const [value, setValue] = useState(initialYears == null ? '' : String(initialYears));
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const years = Number(value);
    if (!value.trim() || Number.isNaN(years) || years < 0 || years > 18) {
      setError('0~18 사이의 나이를 입력해 주세요.');
      return;
    }
    setError(null);
    onSubmit(years);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="child-age" className="text-base font-semibold text-gray-900">
        아이 나이를 알려주세요 <span className="text-red-500">*</span>
      </label>
      <p className="text-sm text-gray-500">한 번에 한 아이 기준으로 확인합니다.</p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          id="child-age"
          type="number"
          inputMode="numeric"
          min={0}
          max={18}
          step={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="예: 5"
          className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-lg focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        <span className="text-base text-gray-600">세 (만 나이)</span>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-blue-600 px-5 py-2 text-base font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? '분석 중…' : '안전성 확인하기'}
        </button>
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
