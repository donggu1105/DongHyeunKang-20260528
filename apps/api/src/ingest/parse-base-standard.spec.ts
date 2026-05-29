import { parseBaseStandard } from './parse-base-standard';

/**
 * 픽스처는 모두 식약처 HtfsInfoService03/getHtfsItem01 실응답의
 * BASE_STANDARD 원문을 그대로 옮긴 것이다(가공 없음).
 */

// 리포좀 종합비타민 — 번호 "N.", 공백 있는 "표시량 ( )", μgRAE/mg α-TE/mgNE/μgDFE/μg 다수
const LIPOSOME = `1. 성상 : 고유의 향미가 있고 이미, 이취가 없는 노랑색의 장방형 제피정제
2. 비타민 C : 표시량 (100 mg / 1,100 mg)의 80~150%
3. 비타민 A : 표시량 (700 μgRAE / 1,100 mg)의 80~150%
4. 비타민 D : 표시량 (10 μg / 1,100 mg)의 80~180%
5. 비타민 E : 표시량 (11 mg α-TE / 1,100 mg)의 80~150%
6. 비타민 B1 : 표시량 (1.2 mg / 1,100 mg)의 80~180%
7. 비타민 B2 : 표시량 (1.4 mg / 1,100 mg)의 80~180%
8. 나이아신 : 표시량 (15 mgNE / 1,100 mg)의 80~150%
9. 판토텐산 : 표시량 (5 mg / 1,100 mg)의 80~180%
10. 비타민 B6 : 표시량 (1.5 mg / 1,100 mg)의 80~150%
11. 엽산 : 표시량 (400 μgDFE / 1,100 mg)의 80~150%
12. 비타민 B12 : 표시량 (2.4 μg / 1,100 mg)의 80~180%`;

// Duosolution 어린이 — 번호 "(N)", 공백 없는 "표시량( )", "80%~150%"(% 먼저), "ug" 글리프, 소수
const KIDS_MINERAL = `(1) 성상 : 고유의 향미가 있고 이미, 이취가 없는 불규칙한 점박이가 있는 회갈색의 원형 정제
(2) 칼슘 : 표시량(210 mg/3,000 mg)의 80%~150%
(3) 마그네슘 : 표시량(105 mg/3,000 mg)의 80%~150%
(4) 비타민D : 표시량(10 ug/3,000 mg)의 80%~180%
(5) 아연 : 표시량(4.25 mg/3,000 mg)의 80%~150%
(6) 망간 : 표시량(0.9 mg/3,000 mg)의 80%~150%
(7) 대장균군 : 음성`;

// 유산균 — 프로바이오틱스 "표시량(... CFU/...)이상"(범위 없음), 성상·대장균군 스킵
const PROBIOTIC = `1. 성상: 고유의 향미가 있고 이미·이취가 없는 흰색 알갱이를 보유한 연한 분홍색의 분말
2. 대장균군: 음성
3. 프로바이오틱스 수: 표시량(10,000,000,000 CFU/2,000mg)이상
4. 아연: 표시량(5mg/2,000mg)의 80~150%
5. 비타민D: 표시량(5㎍/2,000mg)의 80~180%`;

// 홍삼 — 지표성분이 "표시량 5mg/20g 이상"(괄호 없음) → 매칭 안 됨(스킵)
const GINSENG = `1. 성상 : 갈색의 액상
2. 진세노사이드 Rg1,Rb1 및 Rg3의 합 *최종제품:표시량 5mg/20g 이상의 80% 이상
3. 대장균군 : 음성`;

describe('parseBaseStandard', () => {
  it('빈/누락 입력은 빈 배열', () => {
    expect(parseBaseStandard('')).toEqual([]);
    expect(parseBaseStandard(null)).toEqual([]);
    expect(parseBaseStandard(undefined)).toEqual([]);
  });

  it('성상 줄(표시량 없음)은 제외하고 11개 성분만 추출', () => {
    const rows = parseBaseStandard(LIPOSOME);
    expect(rows).toHaveLength(11);
    expect(rows.map((r) => r.name)).toEqual([
      '비타민C',
      '비타민A',
      '비타민D',
      '비타민E',
      '비타민B1',
      '비타민B2',
      '나이아신',
      '판토텐산',
      '비타민B6',
      '엽산',
      '비타민B12',
    ]);
  });

  it('마이크로그램 글리프(μg)와 접미사(RAE/NE/DFE/α-TE) 정규화', () => {
    const by = Object.fromEntries(
      parseBaseStandard(LIPOSOME).map((r) => [r.name, r]),
    );
    expect(by['비타민A'].unit).toBe('㎍ RAE');
    expect(by['비타민D'].unit).toBe('㎍');
    expect(by['비타민E'].unit).toBe('mg α-TE');
    expect(by['나이아신'].unit).toBe('mg NE');
    expect(by['엽산'].unit).toBe('㎍ DFE');
    expect(by['비타민C']).toMatchObject({ amount: 100, unit: 'mg' });
  });

  it('허용범위 하한·상한 추출 (80~150% / 80~180%)', () => {
    const by = Object.fromEntries(
      parseBaseStandard(LIPOSOME).map((r) => [r.name, r]),
    );
    expect(by['비타민C']).toMatchObject({ minPercent: 80, maxPercent: 150 });
    expect(by['비타민D']).toMatchObject({ minPercent: 80, maxPercent: 180 });
  });

  it('(N) 번호 + 공백 없는 표시량 + "80%~150%" + ug 글리프 + 소수', () => {
    const rows = parseBaseStandard(KIDS_MINERAL);
    expect(rows).toHaveLength(5); // 성상·대장균군 제외
    expect(rows[0]).toMatchObject({
      name: '칼슘',
      amount: 210,
      unit: 'mg',
      minPercent: 80,
      maxPercent: 150,
    });
    expect(rows.find((r) => r.name === '비타민D')).toMatchObject({
      amount: 10,
      unit: '㎍', // "ug" → 정규화
      maxPercent: 180,
    });
    expect(rows.find((r) => r.name === '아연')!.amount).toBe(4.25);
    expect(rows.find((r) => r.name === '망간')!.amount).toBe(0.9);
  });

  it('CFU "이상"(범위 없음)은 함량만, 허용범위는 null', () => {
    const rows = parseBaseStandard(PROBIOTIC);
    expect(rows).toHaveLength(3); // 프로바이오틱스 + 아연 + 비타민D
    const prob = rows.find((r) => r.name === '프로바이오틱스수')!;
    expect(prob).toMatchObject({
      amount: 10_000_000_000,
      unit: 'CFU',
      minPercent: null,
      maxPercent: null,
    });
  });

  it('괄호 없는 "표시량 5mg/20g 이상" 형식(홍삼 지표성분)은 스킵', () => {
    expect(parseBaseStandard(GINSENG)).toHaveLength(0);
  });
});
