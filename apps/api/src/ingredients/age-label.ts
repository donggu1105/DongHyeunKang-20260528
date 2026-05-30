/** 개월 범위를 읽기 쉬운 "만 N–M세" 라벨로. min/max는 KDRIs 밴드 경계(개월). */
export function formatAgeLabel(
  ageMinMonths: number,
  ageMaxMonths: number,
): string {
  const minYear = Math.floor(ageMinMonths / 12);
  const maxYear = Math.floor(ageMaxMonths / 12);
  return minYear === maxYear ? `만 ${minYear}세` : `만 ${minYear}–${maxYear}세`;
}
