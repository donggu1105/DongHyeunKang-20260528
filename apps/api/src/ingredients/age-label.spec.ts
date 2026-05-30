import { formatAgeLabel } from './age-label';

describe('formatAgeLabel', () => {
  it('formats a multi-year band as "만 N–M세"', () => {
    expect(formatAgeLabel(72, 107)).toBe('만 6–8세');
    expect(formatAgeLabel(12, 35)).toBe('만 1–2세');
    expect(formatAgeLabel(180, 227)).toBe('만 15–18세');
  });
  it('collapses a single-year band to "만 N세"', () => {
    expect(formatAgeLabel(36, 47)).toBe('만 3세');
  });
});
