import { mapIngredient, mapProductIngredients } from './map-to-catalog';
import { parseBaseStandard } from './parse-base-standard';

const ing = (name: string, amount: number, unit: string) => ({
  name,
  amount,
  unit,
  minPercent: 80,
  maxPercent: 150,
  raw: '',
});

describe('mapIngredient', () => {
  it('캐논 성분은 그대로, 단위 base만 유지', () => {
    expect(mapIngredient(ing('칼슘', 210, 'mg'))).toEqual({
      ingredientName: '칼슘',
      amount: 210,
      unit: 'mg',
    });
  });

  it('영양 접미사를 떼어 엔진이 받는 base 단위로 환원', () => {
    expect(mapIngredient(ing('비타민A', 700, '㎍ RAE'))!.unit).toBe('㎍');
    expect(mapIngredient(ing('비타민E', 11, 'mg α-TE'))!.unit).toBe('mg');
  });

  it('프로바이오틱스수 → 유산균, CFU 절대수 → 억CFU(÷1e8)', () => {
    expect(mapIngredient(ing('프로바이오틱스수', 10_000_000_000, 'CFU'))).toEqual({
      ingredientName: '유산균',
      amount: 100,
      unit: '억CFU',
    });
  });

  it('캐논 밖 성분(마그네슘·나이아신·엽산 등)은 null', () => {
    expect(mapIngredient(ing('마그네슘', 105, 'mg'))).toBeNull();
    expect(mapIngredient(ing('나이아신', 15, 'mg NE'))).toBeNull();
    expect(mapIngredient(ing('엽산', 400, '㎍ DFE'))).toBeNull();
  });
});

describe('mapProductIngredients', () => {
  it('실제 어린이 멀티미네랄: 캐논만 추림(마그네슘·망간 제외)', () => {
    const kids = `(2) 칼슘 : 표시량(210 mg/3,000 mg)의 80%~150%
(3) 마그네슘 : 표시량(105 mg/3,000 mg)의 80%~150%
(4) 비타민D : 표시량(10 ug/3,000 mg)의 80%~180%
(5) 아연 : 표시량(4.25 mg/3,000 mg)의 80%~150%
(6) 망간 : 표시량(0.9 mg/3,000 mg)의 80%~150%`;
    const mapped = mapProductIngredients(parseBaseStandard(kids));
    expect(mapped.map((m) => m.ingredientName)).toEqual(['칼슘', '비타민D', '아연']);
    expect(mapped.find((m) => m.ingredientName === '비타민D')!.unit).toBe('㎍');
  });

  it('중복 캐논 성분은 첫 값만', () => {
    const dup = [ing('비타민C', 100, 'mg'), ing('비타민C', 50, 'mg')];
    const mapped = mapProductIngredients(dup);
    expect(mapped).toHaveLength(1);
    expect(mapped[0].amount).toBe(100);
  });
});
