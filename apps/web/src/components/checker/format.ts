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
