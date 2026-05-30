'use client';

// MVP: 하드코딩된 한국어 문자열 (i18n 메시지 카탈로그 미사용 — 데모용 단순화)
import type { AnalyzeResponse, NutrientResult } from '@/libs/Api';
import { NutrientInfo } from './NutrientInfo';
import { VERDICT_STYLE } from './verdictStyle';

function formatAmount(value: number | null, unit: string): string | null {
  if (value === null) {
    return null;
  }
  // 정수면 그대로, 소수면 최대 2자리까지
  const rounded = Math.round(value * 100) / 100;
  return `${rounded}${unit}`;
}

function NutrientCard({
  nutrient,
  ageMonths,
}: {
  nutrient: NutrientResult;
  ageMonths: number | null;
}) {
  const style = VERDICT_STYLE[nutrient.verdict];
  const total = formatAmount(nutrient.totalCanonical, nutrient.unit);
  const upper = formatAmount(nutrient.upperLimit, nutrient.unit);

  return (
    <div className={`rounded-xl border p-4 ${style.card}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold text-gray-900">
            <NutrientInfo ageMonths={ageMonths} ingredientName={nutrient.ingredientName}>
              {nutrient.ingredientName}
            </NutrientInfo>
          </p>
          {total && (
            <p className="text-2xl font-bold text-gray-900">
              {total}
              {nutrient.productCount > 1 && (
                <span className="ml-2 text-sm font-normal text-gray-500">
                  (제품 {nutrient.productCount}개 합산)
                </span>
              )}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${style.badge}`}>
          {style.icon} {style.label}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-700">
        {nutrient.percentOfRecommended !== null && (
          <span>
            권장의 <strong>{Math.round(nutrient.percentOfRecommended)}%</strong>
          </span>
        )}
        {upper && (
          <span>
            상한 <strong>{upper}</strong>
          </span>
        )}
      </div>

      {nutrient.explanation && (
        <p className="mt-3 text-sm leading-relaxed text-gray-700">{nutrient.explanation}</p>
      )}

      {nutrient.reference && (
        <p className="mt-3 text-xs text-gray-500">
          근거:{' '}
          {nutrient.reference.sourceUrl ? (
            <a
              href={nutrient.reference.sourceUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-blue-700 underline hover:text-blue-900"
            >
              {nutrient.reference.source}
            </a>
          ) : (
            <span>{nutrient.reference.source}</span>
          )}
        </p>
      )}
    </div>
  );
}

export function ReportCard({
  report,
  ageMonths,
}: {
  report: AnalyzeResponse;
  ageMonths: number | null;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-3">
        {report.byNutrient.map((nutrient) => (
          <NutrientCard ageMonths={ageMonths} key={nutrient.ingredientId} nutrient={nutrient} />
        ))}
      </div>

      <p className="rounded-lg bg-gray-100 p-3 text-xs leading-relaxed text-gray-500">
        ⚠️ {report.disclaimer}
      </p>
    </div>
  );
}
