export function formatKRW(value: number | null): string | null {
  if (value === null) {
    return null;
  }
  return `${value.toLocaleString('ko-KR')}원`;
}

// 정상가/판매가가 모두 있고 할인이 양수일 때만 % 반환
export function discountPercent(listPrice: number | null, price: number | null): number | null {
  if (listPrice === null || price === null || listPrice <= 0 || price >= listPrice) {
    return null;
  }
  return Math.round(((listPrice - price) / listPrice) * 100);
}

// 식약처 크롤 제품은 sourceUrl이 "식약처 … 신고번호 N" 형식.
// 식약처 출처가 아니면 null, 맞으면 신고번호(없으면 null)를 담아 반환한다.
export function getMfdsInfo(sourceUrl: string | null): { statementNo: string | null } | null {
  if (!sourceUrl?.startsWith('식약처')) {
    return null;
  }
  return { statementNo: sourceUrl.match(/신고번호\s*(\S+)/u)?.[1] ?? null };
}
