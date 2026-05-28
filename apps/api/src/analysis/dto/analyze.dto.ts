import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  Min,
} from 'class-validator';

export class AnalyzeRequestDto {
  @IsInt()
  @Min(0)
  ageMonths!: number;

  @IsOptional()
  @IsIn(['MALE', 'FEMALE'])
  sex?: 'MALE' | 'FEMALE' | null;

  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  productIds!: number[]; // seed 카탈로그에서 고른 제품 id (현재+후보 합쳐서)
}
