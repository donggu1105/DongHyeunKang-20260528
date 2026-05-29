import { verifyExplanation } from './verify-explanation';

const base = {
  verdict: 'OVER' as const,
  totalCanonical: 41,
  upperLimit: 40,
  recommended: 5,
  percentOfRecommended: 820,
  source: 'KDRIs 2020',
};

describe('verifyExplanation', () => {
  it('accepts an explanation that only uses grounded numbers', () => {
    expect(
      verifyExplanation(
        base,
        '합산량 41㎍로 상한 40㎍를 초과합니다. (출처: KDRIs 2020)',
      ),
    ).toBe(true);
  });

  it('rejects hallucinated numbers not present in the facts', () => {
    expect(verifyExplanation(base, '하루 300mg 이상은 위험합니다.')).toBe(false);
  });

  it('rejects an explanation that contradicts an OVER verdict', () => {
    expect(verifyExplanation(base, '41㎍는 안전한 수준입니다.')).toBe(false);
  });

  it('rejects an explanation that contradicts a SAFE verdict', () => {
    expect(
      verifyExplanation(
        {
          ...base,
          verdict: 'SAFE',
          totalCanonical: 30,
          upperLimit: 510,
          percentOfRecommended: 67,
        },
        '30mg는 상한을 초과합니다.',
      ),
    ).toBe(false);
  });

  it('allows the source year (e.g. KDRIs 2020) without flagging it', () => {
    expect(
      verifyExplanation(base, '41㎍로 상한 40㎍ 초과. 근거: KDRIs 2020'),
    ).toBe(true);
  });

  it('rejects empty explanations', () => {
    expect(verifyExplanation(base, '   ')).toBe(false);
  });
});
