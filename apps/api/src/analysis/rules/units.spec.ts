import { toCanonical } from './units';

describe('toCanonical', () => {
  const vitD = { id: 1, name: '비타민D', canonicalUnit: '㎍', isFatSoluble: true };
  const vitC = { id: 2, name: '비타민C', canonicalUnit: 'mg', isFatSoluble: false };

  it('passes through same unit', () => {
    expect(toCanonical(10, 'mg', vitC)).toBe(10);
  });

  it('converts mcg/㎍/ug to the canonical mass', () => {
    expect(toCanonical(1000, 'mcg', vitC)).toBe(1); // 1000mcg = 1mg
    expect(toCanonical(500, '㎍', vitC)).toBe(0.5);
    expect(toCanonical(2000, 'ug', vitC)).toBe(2);
  });

  it('converts IU to ㎍ for vitamin D (1 IU = 0.025㎍)', () => {
    expect(toCanonical(400, 'IU', vitD)).toBeCloseTo(10, 5); // 400 IU = 10㎍
  });

  it('returns null for an unknown / unconvertible unit', () => {
    expect(toCanonical(5, 'spoons', vitC)).toBeNull();
  });

  it('returns null for IU when the ingredient has no IU conversion factor', () => {
    expect(toCanonical(100, 'IU', vitC)).toBeNull(); // 비타민C has no IU factor
  });

  it('treats mass units case-insensitively', () => {
    expect(toCanonical(1000, 'MCG', vitC)).toBe(1); // 1000mcg = 1mg regardless of case
  });
});
