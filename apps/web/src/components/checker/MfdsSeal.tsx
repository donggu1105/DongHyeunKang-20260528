type Props = { statementNo: string | null };

// 식약처 건강기능식품 인증 씰 — 인스타그램 verified 스타일의 연한 파란 스캘럽 마크.
// 함량 판정과 무관한 "출처 신뢰" 표식. hover 시 안내 툴팁을 띄운다.
export function MfdsSeal({ statementNo }: Props) {
  return (
    <span
      aria-label="식약처 건강기능식품 인증"
      className="group/seal absolute top-2 right-2 z-10"
    >
      <svg aria-hidden="true" className="size-7 drop-shadow" fill="none" viewBox="0 0 24 24">
        {/* 스캘럽(verified) 씰 — 연한 파랑 */}
        <path
          d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.67.88-3.33 2.19c-1.4-.46-2.91-.2-3.92.81s-1.26 2.52-.8 3.91c-1.31.67-2.2 1.91-2.2 3.34s.89 2.67 2.2 3.34c-.46 1.39-.21 2.9.8 3.91s2.52 1.26 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.45 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34z"
          fill="#4da3f7"
        />
        {/* 흰 체크 */}
        <path
          d="m8.5 12.2 2.4 2.4 4.6-4.9"
          fill="none"
          stroke="#fff"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.2}
        />
      </svg>
      {/* hover 안내 툴팁 */}
      <span
        className="pointer-events-none absolute top-full right-0 mt-1.5 w-max max-w-[13rem] rounded-lg bg-gray-900/95 px-2.5 py-1.5 font-medium text-[11px] text-white leading-snug opacity-0 shadow-lg transition-opacity duration-150 group-hover/seal:opacity-100"
        role="tooltip"
      >
        식약처 인증된 제품이에요
        {statementNo ? ` · 신고번호 ${statementNo}` : ''}
      </span>
    </span>
  );
}
