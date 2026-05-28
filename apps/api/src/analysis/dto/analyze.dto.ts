export class AnalyzeRequestDto {
  ageMonths!: number;
  sex?: 'MALE' | 'FEMALE' | null;
  productIds!: number[]; // seed 카탈로그에서 고른 제품 id (현재+후보 합쳐서)
}
