// 페르소나 선택 진입 — POC 데모 레이어 프리셋.
//
// 기존 체커(제품 담기·나이·분석·리포트) 위에 얹는 "랜딩"의 데이터 소스다.
// 제품은 시드 PK(id)가 아니라 *이름*으로 지정한다 — 시드를 다시 돌리면 id가 바뀌므로
// (예: 비타민D3 고함량이 12였다가 다른 값이 됨) 이름→id 해석을 런타임에 한다.
// 카탈로그에 없는 이름은 page.tsx에서 건너뛰고 경고한다.
//
// 세트 구성은 모두 *식약처 신고* 제품(`pnpm crawl` 산출물)으로 채웠다 — 출처 신뢰가
// 페르소나(P3)의 핵심 페인이라서. 단 이 이름들은 크롤을 돌려야 카탈로그에 존재한다.
// 크롤 미실행 시 해당 이름은 건너뛰어져 카트가 빌 수 있다(seed만으론 안 뜸).
//
// 정직성: P4(효능 의심)는 체커 범위(성분 안전) 밖이라 제외한다.

export type PersonaId = 'care' | 'working' | 'beginner' | 'manual';

export type PersonaScenario = {
  id: PersonaId;
  /** 장식용 — 접근성 이름은 title/pain 텍스트가 담당하므로 aria-hidden 처리 */
  emoji: string;
  title: string;
  /** 카드에 노출되는 한 줄 페인 */
  pain: string;
  /** 프리필할 만 나이(년). 직접 선택은 null */
  ageYears: number | null;
  /** 프리필할 장바구니 — 시드 제품 "이름". 런타임에 id로 해석 */
  productNames: string[];
  /** 카드 하단 미리보기 힌트 (이 상황에서 무엇을 보게 되는지). 직접 선택은 생략 */
  hint?: string;
  /** 커머스형 "테마 세트" 라벨 — 히어로 카드를 상품 세트처럼 보이게 한다. 직접 선택은 없음 */
  setName?: string;
  /**
   * 세트 섹션 제목(h2)에 쓰는 *엄마 관점* 설득 헤드라인.
   * setName(상품 라벨)과 달리, 페르소나의 페인을 직접 찔러 "내 얘기"로 읽히게 한다.
   * 예: "환절기 면역이 걱정되는 엄마들 주목!" / 없으면 setName으로 폴백.
   */
  headline?: string;
  /**
   * 세트 전용 대표 히어로 배너(`apps/web/public/hero/*.png`, Pencil 디자인).
   * 배지·헤드라인·나이 태그가 *이미지에 구워져* 있으므로, 있으면 SetSection이
   * 첫 제품 사진+오버레이 대신 이 배너를 통째로 쓰고 액션 행만 아래에 둔다.
   */
  heroImage?: string;
};

export const PERSONA_SCENARIOS: PersonaScenario[] = [
  {
    id: 'care',
    emoji: '🤧',
    setName: '환절기 면역 케어 세트',
    headline: '환절기 면역 챙기는 엄마들 주목! 여러 개 먹이다 비타민D 겹치진 않았나요?',
    heroImage: '/hero/care.png',
    title: '면역 케어맘',
    pain: '여러 개 먹이는데 겹칠까 걱정돼요',
    ageYears: 8,
    // 식약처 신고 제품 4종 — 비타민D가 4개 모두에 겹쳐 만 8세 기준 과다(OVER)로 검증됨.
    productNames: [
      'Ur.PNT 하트톡톡 어린이비타민D 1000IU',
      '어린이 비타민D 드롭',
      '어린이 비타민D 아연 3중기능성 플러스',
      'Duosolution DMAX Kids UP 어린이 칼슘 마그네슘 아연 비타민D 망간 뼈건강 초코맛 츄어블 정제',
    ],
    hint: '예시: 비타민D가 여러 제품에 겹쳐 과다로 떠요',
  },
  {
    id: 'working',
    emoji: '⏱️',
    setName: '바쁜 아침 비타민D 점검',
    headline: '시간 없는 워킹맘 주목! 딱 하나만 30초 안전 점검',
    heroImage: '/hero/working.png',
    title: '워킹맘',
    pain: '바빠서 딱 하나만 빠르게 확인하고 싶어요',
    ageYears: 6,
    // 식약처 신고 단일 제품 — 만 6세 기준 안전(SAFE) 빠른 확인.
    productNames: ['Ur.PNT 하트톡톡 어린이비타민D 1000IU'],
    hint: '예시: 딱 1개만 빠르게',
  },
  {
    id: 'beginner',
    emoji: '🍼',
    setName: '첫 영양제 입문 세트',
    headline: '첫 영양제, 뭐가 안전한지 막막한 초보맘 주목!',
    heroImage: '/hero/beginner.png',
    title: '초보맘',
    pain: '처음이라 뭐가 안전한지 모르겠어요',
    ageYears: 3,
    // 식약처 신고 제품 — 유산균은 KDRIs 기준이 없어 확인불가(UNKNOWN)로 정직하게 표시.
    productNames: ['서흥 어린이 수퍼바이오틱스', '어린이 멀티비타민'],
    hint: '예시: 유산균은 확인불가로 정직하게',
  },
  {
    id: 'manual',
    emoji: '✏️',
    title: '직접 선택',
    pain: '내가 먹이는 걸로 직접 담을래요',
    ageYears: null,
    productNames: [],
  },
];
