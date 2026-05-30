import { Env } from '@/libs/Env';

/**
 * Tiny client for the trust-checker NestJS backend (local dev on :3001).
 * CORS is open on the API, so the browser can call it directly.
 */

const API_BASE_URL = Env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ── Catalog (GET /products) ───────────────────────────────────────────────
export type CatalogIngredient = {
  name: string;
  amount: number;
  unit: string;
};

export type CatalogProduct = {
  id: number;
  name: string;
  brand: string | null;
  form: string | null;
  targetAgeLabel: string | null;
  sourceUrl: string | null;
  imageUrl: string | null;
  price: number | null;
  listPrice: number | null;
  ingredients: CatalogIngredient[];
};

// ── Ingredient reference (GET /ingredients) ───────────────────────────────
export type IngredientReference = {
  ageMinMonths: number;
  ageMaxMonths: number;
  ageLabel: string;
  recommended: number | null;
  upperLimit: number | null;
  unit: string;
};

export type IngredientInfo = {
  id: number;
  name: string;
  canonicalUnit: string;
  isFatSoluble: boolean;
  references: IngredientReference[];
  source: string;
  sourceUrl: string | null;
};

// ── Analysis (POST /analyze) ──────────────────────────────────────────────
export type Verdict = 'SAFE' | 'DUPLICATE' | 'OVER' | 'UNKNOWN';

export type AnalyzeRequest = {
  ageMonths: number;
  sex?: 'MALE' | 'FEMALE' | null;
  productIds: number[];
};

export type NutrientReference = {
  source: string;
  sourceUrl: string | null;
};

export type NutrientResult = {
  ingredientId: number;
  ingredientName: string;
  totalCanonical: number | null;
  unit: string;
  productCount: number;
  recommended: number | null;
  upperLimit: number | null;
  percentOfRecommended: number | null;
  verdict: Verdict;
  reference: NutrientReference | null;
  explanation: string;
};

export type AnalyzeResponse = {
  byNutrient: NutrientResult[];
  disclaimer: string;
};

/** Thrown when the API responds with a non-2xx status or is unreachable. */
export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
  } catch {
    // Network failure / API down — surface a friendly, typed error.
    throw new ApiError('API 서버에 연결할 수 없습니다.');
  }

  if (!res.ok) {
    throw new ApiError(`API 요청이 실패했습니다 (HTTP ${res.status}).`, res.status);
  }

  return res.json() as Promise<T>;
}

export function getProducts(): Promise<CatalogProduct[]> {
  return request<CatalogProduct[]>('/products');
}

export function getIngredients(): Promise<IngredientInfo[]> {
  return request<IngredientInfo[]>('/ingredients');
}

export function analyze(payload: AnalyzeRequest): Promise<AnalyzeResponse> {
  return request<AnalyzeResponse>('/analyze', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
