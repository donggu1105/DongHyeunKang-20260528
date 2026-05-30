'use client';

import { useState } from 'react';
import type { AnalyzeResponse } from '@/libs/Api';
import { analyze, ApiError } from '@/libs/Api';
import { composeSummary, formatNutrientLine } from './nudgeSummary';
import { RecommendedSetCard } from './RecommendedSetCard';
import { ReportCard } from './ReportCard';
import { VERDICT_STYLE } from './verdictStyle';

type Props = {
  initialAgeYears: number | null;
  productIds: number[];
  onClose: () => void; // 닫기 → checkout 유지
  onAdjust: () => void; // 상품 다시 담기 → 목록
  onConfirmPay: () => void; // 결제 → 완료
};

type AgeStepProps = {
  ageInput: string;
  ageValid: boolean;
  initialAgeYears: number | null;
  onAgeInput: (value: string) => void;
  onAnalyze: () => void;
};

function AgeStep({ ageInput, ageValid, initialAgeYears, onAgeInput, onAnalyze }: AgeStepProps) {
  return (
    <div className="px-6 py-6">
      <h2 className="text-2xl font-bold text-gray-900" id="nudge-title">
        잠깐, 아이 나이를 확인할게요
      </h2>
      <p className="mt-1 text-sm text-gray-600">
        {initialAgeYears === null
          ? '결제 전, 만 나이 기준으로 중복·과다를 분석해 드려요.'
          : `혹시 만 ${initialAgeYears}세가 맞나요? 아니면 고쳐 주세요.`}
      </p>
      <div className="mt-4 flex items-center gap-2">
        <input
          aria-label="아이 나이 (만 나이)"
          className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none"
          inputMode="numeric"
          max={18}
          min={0}
          onChange={(e) => {
            onAgeInput(e.target.value);
          }}
          placeholder="예: 5"
          type="number"
          value={ageInput}
        />
        <span className="text-base text-gray-600">세</span>
      </div>
      <button
        className="mt-6 w-full cursor-pointer rounded-lg bg-blue-600 px-5 py-3 text-lg font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={!ageValid}
        onClick={onAnalyze}
        type="button"
      >
        이 나이로 분석하기
      </button>
      {!ageValid && (
        <p className="mt-2 text-center text-xs text-gray-400">만 나이(0~18)를 입력해 주세요.</p>
      )}
    </div>
  );
}

function NutrientLines({ report }: { report: AnalyzeResponse }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-gray-900">성분별 권장량</p>
      {report.byNutrient.map((n) => {
        const line = formatNutrientLine(n);
        const style = VERDICT_STYLE[n.verdict];
        return (
          <div
            className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 px-3 py-2 text-sm"
            key={n.ingredientId}
          >
            <span className="font-medium text-gray-900">
              {style.icon} {n.ingredientName}
            </span>
            <span className="text-gray-600">
              {line.recommended} · {line.current}
            </span>
          </div>
        );
      })}
    </div>
  );
}

type ResultBodyProps = {
  ageYears: number;
  errorMsg: string | null;
  hasRisk: boolean;
  loading: boolean;
  onRetry: () => void;
  productCount: number;
  report: AnalyzeResponse | null;
};

function ResultBody({
  ageYears,
  errorMsg,
  hasRisk,
  loading,
  onRetry,
  productCount,
  report,
}: ResultBodyProps) {
  const [showDetail, setShowDetail] = useState(false);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
        <span className="size-8 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="text-sm">안전하게 확인하는 중…</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="flex flex-col gap-3" role="alert">
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {errorMsg}
        </p>
        <button
          className="cursor-pointer self-start rounded-lg border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          onClick={onRetry}
          type="button"
        >
          다시 시도
        </button>
      </div>
    );
  }

  if (!report) {
    return null;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ① 종합 배너 */}
      {hasRisk ? (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4">
          <p className="text-lg font-bold text-red-800">⚠️ 잠깐만요, 확인이 필요해요</p>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-green-300 bg-green-50 p-4">
          <p className="text-lg font-bold text-green-800">✅ 안전하게 구성됐어요</p>
        </div>
      )}

      {/* ② AI 종합 문단 (룰 조합) */}
      <p className="rounded-xl bg-blue-50/70 p-4 text-sm leading-relaxed text-gray-800">
        🤖 {composeSummary(report, ageYears, productCount)}
      </p>

      {/* 위험 시 검증된 세트 (OVER 없으면 컴포넌트가 자동 null) */}
      <RecommendedSetCard ageYears={ageYears} report={report} />

      {/* ③ 성분별 1줄 (전부 나열) */}
      <NutrientLines report={report} />

      {/* ④ 자세히 보기 → 기존 상세 ReportCard */}
      <button
        className="cursor-pointer self-start text-sm font-semibold text-blue-700 hover:underline"
        onClick={() => {
          setShowDetail((v) => !v);
        }}
        type="button"
      >
        {showDetail ? '▾ 자세히 닫기' : '▸ 자세히 보기 (상한·근거·설명)'}
      </button>
      {showDetail && <ReportCard ageMonths={Math.round(ageYears * 12)} report={report} />}
    </div>
  );
}

type ResultStepProps = {
  ageYears: number;
  errorMsg: string | null;
  loading: boolean;
  onAdjust: () => void;
  onConfirmPay: () => void;
  onRetry: () => void;
  productIds: number[];
  report: AnalyzeResponse | null;
};

function ResultStep({
  ageYears,
  errorMsg,
  loading,
  onAdjust,
  onConfirmPay,
  onRetry,
  productIds,
  report,
}: ResultStepProps) {
  const hasRisk =
    report?.byNutrient.some((n) => n.verdict === 'OVER' || n.verdict === 'DUPLICATE') ?? false;

  return (
    <>
      <div className="border-b border-gray-100 px-6 pt-6 pb-4">
        <h2 className="text-2xl font-bold text-gray-900" id="nudge-title">
          내 아이한테 지금 맞을까요?
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          만 {ageYears}세 · 담은 {productIds.length}개 제품 기준
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <ResultBody
          ageYears={ageYears}
          errorMsg={errorMsg}
          hasRisk={hasRisk}
          loading={loading}
          onRetry={onRetry}
          productCount={productIds.length}
          report={report}
        />
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
    </>
  );
}

export function NudgeModal({
  initialAgeYears,
  productIds,
  onClose,
  onAdjust,
  onConfirmPay,
}: Props) {
  const [step, setStep] = useState<'age' | 'result'>('age');
  const [ageInput, setAgeInput] = useState(initialAgeYears === null ? '' : String(initialAgeYears));
  const [report, setReport] = useState<AnalyzeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const ageNum = ageInput.trim() === '' ? null : Number(ageInput);
  const ageValid = ageNum !== null && !Number.isNaN(ageNum) && ageNum >= 0 && ageNum <= 18;
  const ageYears = ageValid ? ageNum : 0;

  const runAnalyze = async () => {
    if (!ageValid) {
      return;
    }
    setStep('result');
    setLoading(true);
    setErrorMsg(null);
    try {
      const r = await analyze({ ageMonths: Math.round(ageYears * 12), productIds });
      setReport(r);
    } catch (error) {
      setErrorMsg(error instanceof ApiError ? error.message : '분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

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
        {step === 'age' && (
          <AgeStep
            ageInput={ageInput}
            ageValid={ageValid}
            initialAgeYears={initialAgeYears}
            onAgeInput={setAgeInput}
            onAnalyze={() => {
              void runAnalyze();
            }}
          />
        )}

        {step === 'result' && (
          <ResultStep
            ageYears={ageYears}
            errorMsg={errorMsg}
            loading={loading}
            onAdjust={onAdjust}
            onConfirmPay={onConfirmPay}
            onRetry={() => {
              void runAnalyze();
            }}
            productIds={productIds}
            report={report}
          />
        )}
      </div>
    </div>
  );
}
