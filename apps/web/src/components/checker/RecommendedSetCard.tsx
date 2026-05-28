'use client';

// MVP/시연용: 실제 결제·재고 연동 없는 정적 추천 미리보기
import type { AnalyzeResponse } from '@/libs/Api';

type RecommendedSetCardProps = {
  report: AnalyzeResponse;
  ageYears: number;
};

export function RecommendedSetCard({ report, ageYears }: RecommendedSetCardProps) {
  const overNutrients = report.byNutrient.filter((n) => n.verdict === 'OVER');

  // 과다 성분이 없으면 추천 세트를 노출하지 않는다 (차별점은 "문제가 있을 때"만 가치).
  if (overNutrients.length === 0) {
    return null;
  }

  const overNames = overNutrients.map((n) => n.ingredientName).join(' · ');

  return (
    <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg font-bold text-emerald-900">✅ 검증된 세트</p>
        <span className="rounded-full bg-emerald-200 px-2 py-0.5 text-xs font-semibold text-emerald-800">
          시연용
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-emerald-900">
        겹치는 성분(<strong>{overNames}</strong>)을 빼고, 만 {ageYears}세 기준{' '}
        <strong>중복·과다 0</strong>으로 검증된 세트로 교체해 보세요.
      </p>

      <p className="mt-3 text-xs text-emerald-700">
        * 추천 미리보기입니다. 실제 구매·결제로 이어지지 않습니다.
      </p>
    </div>
  );
}
