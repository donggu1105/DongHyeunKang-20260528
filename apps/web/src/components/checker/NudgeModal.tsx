'use client';

import { useEffect, useState } from 'react';
import type { AnalyzeResponse } from '@/libs/Api';
import { analyze, ApiError } from '@/libs/Api';
import { RecommendedSetCard } from './RecommendedSetCard';
import { ReportCard } from './ReportCard';

type Props = {
  ageYears: number;
  productIds: number[];
  onClose: () => void; // 닫기 → 결제 페이지로
  onAdjust: () => void; // 상품 다시 담기 → 목록으로
  onConfirmPay: () => void; // 그래도/안전하게 결제 → 완료
};

export function NudgeModal({ ageYears, productIds, onClose, onAdjust, onConfirmPay }: Props) {
  const [report, setReport] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setErrorMsg(null);
    const run = async () => {
      try {
        const r = await analyze({ ageMonths: Math.round(ageYears * 12), productIds });
        if (active) {
          setReport(r);
          setLoading(false);
        }
      } catch (error) {
        if (active) {
          setErrorMsg(error instanceof ApiError ? error.message : '분석 중 오류가 발생했습니다.');
          setLoading(false);
        }
      }
    };
    void run();
    return () => {
      active = false;
    };
  }, [ageYears, productIds]);

  const hasRisk =
    report?.byNutrient.some((n) => n.verdict === 'OVER' || n.verdict === 'DUPLICATE') ?? false;
  const overNames =
    report?.byNutrient.filter((n) => n.verdict === 'OVER').map((n) => n.ingredientName) ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        aria-label="닫기"
        className="absolute inset-0 cursor-pointer bg-black/50"
        onClick={onClose}
        type="button"
      />
      <div
        aria-labelledby="nudge-title"
        aria-modal="true"
        className="relative z-10 flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        role="dialog"
      >
        <div className="border-b border-gray-100 px-6 pt-6 pb-4">
          <h2 className="text-2xl font-bold text-gray-900" id="nudge-title">
            내 아이한테 지금 맞을까요?
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            결제 전, 만 {ageYears}세 기준으로 중복·과다를 마지막으로 확인해 드려요.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading && (
            <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
              <span className="size-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
              <p className="text-sm">안전하게 확인하는 중…</p>
            </div>
          )}

          {errorMsg && !loading && (
            <p
              className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              role="alert"
            >
              {errorMsg}
            </p>
          )}

          {report && !loading && (
            <div className="flex flex-col gap-4">
              {hasRisk ? (
                <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
                  <p className="text-lg font-bold text-red-800">⚠️ 잠깐만요, 확인이 필요해요</p>
                  <p className="mt-1 text-sm text-red-700">
                    {overNames.length > 0 ? (
                      <>
                        <strong>{overNames.join(' · ')}</strong>이(가) 만 {ageYears}세 상한을
                        초과해요. 이대로 결제하면 과다 섭취 위험이 있어요.
                      </>
                    ) : (
                      <>겹치는 성분이 있어요. 결제 전에 한 번 더 확인해 주세요.</>
                    )}
                  </p>
                </div>
              ) : (
                <div className="rounded-xl border-2 border-green-300 bg-green-50 p-4">
                  <p className="text-lg font-bold text-green-800">✅ 안전하게 구성됐어요</p>
                  <p className="mt-1 text-sm text-green-700">
                    만 {ageYears}세 기준 중복·과다 없이 안전한 조합이에요. 안심하고 결제하세요.
                  </p>
                </div>
              )}

              <RecommendedSetCard ageYears={ageYears} report={report} />
              <ReportCard report={report} />
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-gray-100 px-6 py-4">
          {hasRisk ? (
            <>
              <button
                className="flex-1 cursor-pointer rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-blue-700"
                onClick={onAdjust}
                type="button"
              >
                상품 다시 담기
              </button>
              <button
                className="cursor-pointer rounded-lg border border-gray-300 px-4 py-3 text-base font-semibold text-gray-600 transition hover:bg-gray-50"
                onClick={onConfirmPay}
                type="button"
              >
                그래도 결제
              </button>
            </>
          ) : (
            <button
              className="flex-1 cursor-pointer rounded-lg bg-blue-600 px-4 py-3 text-base font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
              disabled={loading}
              onClick={onConfirmPay}
              type="button"
            >
              안전해요, 결제하기
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
