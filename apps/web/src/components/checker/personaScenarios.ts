// 페르소나 선택 진입 — POC 데모 레이어 프리셋.
//
// 기존 체커(제품 담기·나이·분석·리포트) 위에 얹는 "랜딩"의 데이터 소스다.
// 제품은 시드 PK(id)가 아니라 *이름*으로 지정한다 — 시드를 다시 돌리면 id가 바뀌므로
// (예: 비타민D3 고함량이 12였다가 다른 값이 됨) 이름→id 해석을 런타임에 한다.
// 카탈로그에 없는 이름은 page.tsx에서 건너뛰고 경고한다.
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
  /** 커머스형 "테마 세트" 라벨 — 카드를 상품 세트처럼 보이게 한다. 직접 선택은 없음 */
  setName?: string;
};

export const PERSONA_SCENARIOS: PersonaScenario[] = [
  {
    id: 'care',
    emoji: '🤧',
    setName: '환절기 면역 케어 세트',
    title: '면역 케어맘',
    pain: '여러 개 먹이는데 겹칠까 걱정돼요',
    ageYears: 8,
    productNames: [
      '키즈 종합비타민 구미',
      '프로바이오틱스 키즈',
      '비타민D 드롭',
      '비타민D3 구미 고함량',
    ],
    hint: '예시: 비타민D가 여러 제품에 겹쳐요',
  },
  {
    id: 'working',
    emoji: '⏱️',
    setName: '바쁜 아침 비타민D 점검',
    title: '워킹맘',
    pain: '바빠서 딱 하나만 빠르게 확인하고 싶어요',
    ageYears: 6,
    productNames: ['비타민D3 구미 고함량'],
    hint: '예시: 딱 1개만 빠르게',
  },
  {
    id: 'beginner',
    emoji: '🍼',
    setName: '첫 영양제 입문 세트',
    title: '초보맘',
    pain: '처음이라 뭐가 안전한지 모르겠어요',
    ageYears: 3,
    productNames: ['프로바이오틱스 키즈', '종합비타민 시럽'],
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
