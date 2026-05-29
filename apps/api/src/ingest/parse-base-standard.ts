/**
 * 식약처 건강기능식품정보 API(HtfsInfoService03/getHtfsItem01)의
 * BASE_STANDARD(기준규격) 자유텍스트를 구조화된 성분 행으로 파싱한다.
 *
 * 실데이터 100개 제품(412개 성분줄)을 표본 분석해 도출한 규칙:
 *   - 줄 구분자는 실제 개행("\n").
 *   - 성분 함량 줄은 모두 "표시량"을 포함한다. 오염물질·미생물 한계치
 *     (납/카드뮴/수은/대장균군/세균수/성상/붕해)는 "이하/음성"을 쓰고
 *     "표시량"이 없으므로, 표시량 앵커만으로 비성분 줄이 자동 제외된다.
 *   - 형식: "{번호} {성분명} : 표시량 ({함량} {단위} / {총량})의 {하한}~{상한}%"
 *     번호 표기((2)/2./②)·공백 유무·% 위치는 제각각이라 정규식으로 흡수.
 *   - 마이크로그램은 ㎍/μg/µg/ug 네 글리프로 들어와 canonical "㎍"로 통일
 *     (분석 엔진 units.ts의 표기와 일치시키기 위함).
 *   - NE(나이아신)/RAE(비타민A)/DFE(엽산)/α-TE(비타민E) 접미사는 영양적
 *     의미가 있어 보존한다.
 *   - 매칭 안 되는 줄(홍삼 지표성분, CFU "이상" 등)은 graceful skip 또는
 *     함량만 추출하고 허용범위는 null로 둔다.
 */

export interface ParsedIngredient {
  /** 공백 제거 정규화된 성분명. 예: "비타민 C" → "비타민C" */
  name: string;
  /** 표시량 수치(콤마 제거). 예: 100, 4.25, 10000000000 */
  amount: number;
  /** 정규화 단위. 예: "mg" | "㎍" | "㎍ RAE" | "mg NE" | "mg α-TE" | "CFU" */
  unit: string;
  /** 식약처 허용범위 하한(%). 예: 80. 표기 없으면 null */
  minPercent: number | null;
  /** 식약처 허용범위 상한(%). 예: 150/180. 표기 없으면 null */
  maxPercent: number | null;
  /** 원본 매칭 줄(감사·디버깅용) */
  raw: string;
}

const PYOSHI = '표시량';

// 마이크로그램 글리프 → canonical "㎍"
const MICROGRAM = new Set(['㎍', 'μg', 'µg', 'ug', 'mcg']);

// 단위 토큰: 질량 base + (선택)영양 접미사. mcg를 mg보다 먼저 둬야 오인식 방지.
const UNIT_RE = /^(㎎|mcg|mg|㎍|μg|µg|ug|g)\s*(NE|RAE|DFE|RE|α-TE|a-TE)?$/i;

// "표시량(함량 단위/총량" 에서 함량과 단위를 캡처. 슬래시 직전까지가 단위.
const AMOUNT_UNIT_RE =
  /표시량\s*\(\s*([\d,]+(?:\.\d+)?)\s*([^\d/)][^/)]*?)\s*\//;

// ")의 80~150%" / ")의 80%~150%" / "80-180%" 등에서 하한·상한 캡처.
const RANGE_RE = /\)\s*의\s*(\d+)\s*%?\s*[~\-]\s*(\d+)\s*%/;

// 줄 앞 번호 표기 제거: (2) / 2. / 2) / ②
const PREFIX_RE = /^\s*(?:\(\d+\)|\d+\s*[.)]|[①-⑳])\s*/;

/** 단위 문자열을 정규화. 질량 단위가 아니면(CFU/억 등) 원형 유지. */
function normalizeUnit(raw: string): string {
  const u = raw.replace(/\s+/g, ' ').trim();
  const m = u.match(UNIT_RE);
  if (!m) return u;
  let base = m[1];
  if (MICROGRAM.has(base)) base = '㎍';
  else if (base === '㎎') base = 'mg';
  else base = base.toLowerCase(); // mg / g
  if (!m[2]) return base;
  const suffix = /te$/i.test(m[2]) ? 'α-TE' : m[2].toUpperCase();
  return `${base} ${suffix}`;
}

/**
 * BASE_STANDARD 텍스트 → 성분 행 배열. 빈/누락 입력은 [].
 * 함량을 못 뽑는 줄은 조용히 건너뛴다(graceful).
 */
export function parseBaseStandard(
  baseStandard: string | null | undefined,
): ParsedIngredient[] {
  if (!baseStandard) return [];

  const out: ParsedIngredient[] = [];
  for (const rawLine of baseStandard.split(/[\r\n]+/)) {
    const line = rawLine.trim();
    if (!line.includes(PYOSHI)) continue;

    const au = line.match(AMOUNT_UNIT_RE);
    if (!au) continue;
    const amount = Number(au[1].replace(/,/g, ''));
    if (!Number.isFinite(amount)) continue;

    // 성분명: "표시량" 앞 → ":" 앞 → 번호 접두 제거 → 내부 공백 제거
    let name = line.slice(0, line.indexOf(PYOSHI));
    const colon = name.lastIndexOf(':');
    if (colon >= 0) name = name.slice(0, colon);
    name = name.replace(PREFIX_RE, '').replace(/\s+/g, '');
    if (!name) continue;

    const rg = line.match(RANGE_RE);
    out.push({
      name,
      amount,
      unit: normalizeUnit(au[2]),
      minPercent: rg ? Number(rg[1]) : null,
      maxPercent: rg ? Number(rg[2]) : null,
      raw: line,
    });
  }
  return out;
}
