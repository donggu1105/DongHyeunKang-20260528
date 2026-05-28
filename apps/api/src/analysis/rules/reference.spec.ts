import { selectReference } from './reference';
import type { ReferenceDef } from '../analysis.types';

const refs: ReferenceDef[] = [
  { ingredientId: 1, ageMinMonths: 72, ageMaxMonths: 107, sex: null, recommended: 5, upperLimit: 40, unit: '㎍', source: 'KDRIs 2020', sourceUrl: null },
  { ingredientId: 1, ageMinMonths: 108, ageMaxMonths: 143, sex: null, recommended: 5, upperLimit: 60, unit: '㎍', source: 'KDRIs 2020', sourceUrl: null },
];

describe('selectReference', () => {
  it('picks the band containing the age in months', () => {
    expect(selectReference(refs, 96, null)?.upperLimit).toBe(40); // 8세
    expect(selectReference(refs, 120, null)?.upperLimit).toBe(60); // 10세
  });
  it('returns null when no band matches', () => {
    expect(selectReference(refs, 12, null)).toBeNull();
  });
  it('prefers a sex-specific band over a null-sex band when sex given', () => {
    const withSex: ReferenceDef[] = [
      { ...refs[0], sex: null, upperLimit: 40 },
      { ...refs[0], sex: 'FEMALE', upperLimit: 35 },
    ];
    expect(selectReference(withSex, 96, 'FEMALE')?.upperLimit).toBe(35);
  });
  it('returns null rather than guessing the opposite-sex band (fail-safe)', () => {
    const maleOnly: ReferenceDef[] = [{ ...refs[0], sex: 'MALE', upperLimit: 45 }];
    expect(selectReference(maleOnly, 96, 'FEMALE')).toBeNull();
  });
  it('returns null when only a sexed band exists and no sex was requested', () => {
    const sexedOnly: ReferenceDef[] = [{ ...refs[0], sex: 'MALE', upperLimit: 45 }];
    expect(selectReference(sexedOnly, 96, null)).toBeNull();
  });
});
