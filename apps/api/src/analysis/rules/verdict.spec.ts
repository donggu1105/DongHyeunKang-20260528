import { judge } from './verdict';
import type { ReferenceDef } from '../analysis.types';

const ref: ReferenceDef = { ingredientId: 1, ageMinMonths: 72, ageMaxMonths: 107, sex: null, recommended: 5, upperLimit: 40, unit: '㎍', source: 'KDRIs 2020', sourceUrl: null };

describe('judge', () => {
  it('UNKNOWN when no reference', () => {
    expect(judge(25, 2, null).verdict).toBe('UNKNOWN');
  });
  it('UNKNOWN when total is null (normalization failed)', () => {
    expect(judge(null, 1, ref).verdict).toBe('UNKNOWN');
  });
  it('OVER only when total exceeds the upper limit', () => {
    expect(judge(41, 1, ref).verdict).toBe('OVER');
  });
  it('DUPLICATE when in >=2 products but still within UL (거짓경보 금지)', () => {
    const r = judge(25, 2, ref); // 25㎍ = 권장5의 500% 이지만 UL 40 이내
    expect(r.verdict).toBe('DUPLICATE');
    expect(r.percentOfRecommended).toBe(500); // 높은 %는 정보일 뿐, OVER 아님
  });
  it('SAFE when single product and within UL', () => {
    expect(judge(5, 1, ref).verdict).toBe('SAFE');
  });
  it('treats total === upperLimit as SAFE (not OVER) for a single product', () => {
    expect(judge(40, 1, ref).verdict).toBe('SAFE'); // UL=40, exactly at limit is not over
  });
  it('treats total === upperLimit as DUPLICATE when in >=2 products', () => {
    expect(judge(40, 2, ref).verdict).toBe('DUPLICATE');
  });
  it('percentOfRecommended is null when recommended is null (verdict unaffected)', () => {
    const noRda: ReferenceDef = { ...ref, recommended: null };
    const r = judge(10, 1, noRda);
    expect(r.percentOfRecommended).toBeNull();
    expect(r.verdict).toBe('SAFE'); // within UL
  });
  it('percentOfRecommended is null when recommended is 0 (no Infinity/NaN)', () => {
    const zeroRda: ReferenceDef = { ...ref, recommended: 0 };
    const r = judge(10, 1, zeroRda);
    expect(r.percentOfRecommended).toBeNull();
    expect(Number.isFinite(r.percentOfRecommended as number)).toBe(false);
  });
});
