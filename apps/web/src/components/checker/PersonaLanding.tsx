'use client';

// 페르소나 선택 진입 화면 (POC 데모 레이어).
// 카드를 고르면 page.tsx가 나이·장바구니를 프리필하고 기존 체커로 넘긴다.
// MVP: 하드코딩된 한국어 문자열 (i18n 카탈로그 미사용 — 데모용 단순화).
import { PERSONA_SCENARIOS, type PersonaScenario } from './personaScenarios';

type PersonaLandingProps = {
  onSelect: (scenario: PersonaScenario) => void;
};

export function PersonaLanding({ onSelect }: PersonaLandingProps) {
  return (
    <section aria-labelledby="persona-heading">
      {/* 정직한 범위 고지: 이 도구는 효능이 아니라 성분 안전을 본다 */}
      <div className="mb-5 flex items-start gap-2 rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
        <InfoIcon />
        <p>
          효능이 아니라 <strong className="font-semibold text-gray-800">성분 안전</strong>(중복·과다
          섭취)을 확인해 드려요.
        </p>
      </div>

      <h2 id="persona-heading" className="mb-1 text-xl font-semibold text-gray-900">
        어떤 상황에 가까우세요?
      </h2>
      <p className="mb-4 text-sm text-gray-500">
        고르면 예시로 미리 담아 드려요. 언제든 직접 바꿀 수 있어요.
      </p>

      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        {PERSONA_SCENARIOS.map((scenario) => {
          const isManual = scenario.id === 'manual';
          return (
            <li key={scenario.id}>
              <button
                type="button"
                onClick={() => onSelect(scenario)}
                className={`group flex h-full w-full cursor-pointer items-center gap-3 rounded-2xl border p-5 text-left transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                  isManual
                    ? 'border-dashed border-gray-300 bg-white hover:border-gray-400 hover:bg-gray-50'
                    : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40 hover:shadow-md'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`flex size-12 shrink-0 items-center justify-center rounded-xl text-2xl leading-none ${
                    isManual ? 'bg-gray-100' : 'bg-blue-50'
                  }`}
                >
                  {scenario.emoji}
                </span>

                <span className="flex min-w-0 flex-col gap-1">
                  <span className="text-base font-semibold text-gray-900">{scenario.title}</span>
                  <span className="text-sm text-gray-600">{scenario.pain}</span>
                  {scenario.hint && (
                    <span className="mt-1 inline-flex w-fit rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                      {scenario.hint}
                    </span>
                  )}
                </span>

                <ChevronIcon />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// 기능 아이콘은 이모지 대신 SVG (Heroicons information-circle, outline).
function InfoIcon() {
  return (
    <svg
      aria-hidden="true"
      className="mt-0.5 size-4 shrink-0 text-gray-400"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.8}
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"
      />
    </svg>
  );
}

// 클릭 가능함을 알리는 우측 chevron — 레이아웃을 흔드는 transform 대신 색 전이만 (group-hover).
function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      className="ml-auto size-5 shrink-0 self-center text-gray-300 transition-colors group-hover:text-blue-400"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}
