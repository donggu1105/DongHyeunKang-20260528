import { describe, expect, it } from 'vitest';
import { formatIuHelper, NUTRIENT_ROLE } from './nutrientFacts';

describe('nutrientFacts', () => {
  it('converts canonical amount to an IU helper string for fat-soluble vitamins', () => {
    expect(formatIuHelper('비타민D', 25)).toBe('25㎍ = 1000 IU');
  });
  it('returns null for nutrients with no IU convention (e.g., 칼슘)', () => {
    expect(formatIuHelper('칼슘', 300)).toBeNull();
  });
  it('has a short role copy for every canon nutrient', () => {
    for (const n of ['비타민D', '비타민A', '비타민C', '비타민E', '칼슘', '철', '아연', '유산균']) {
      expect(NUTRIENT_ROLE[n]).toBeTruthy();
    }
  });
});
