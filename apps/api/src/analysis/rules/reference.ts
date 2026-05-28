import type { ReferenceDef, Sex } from '../analysis.types';

export function selectReference(refs: ReferenceDef[], ageMonths: number, sex: Sex | null): ReferenceDef | null {
  const inBand = refs.filter((r) => ageMonths >= r.ageMinMonths && ageMonths <= r.ageMaxMonths);
  if (inBand.length === 0) return null;
  if (sex) {
    const exact = inBand.find((r) => r.sex === sex);
    if (exact) return exact;
  }
  return inBand.find((r) => r.sex === null) ?? inBand[0];
}
