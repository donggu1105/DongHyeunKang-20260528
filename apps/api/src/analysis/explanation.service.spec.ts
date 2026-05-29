import { ExplanationService } from './explanation.service';
import type { ExplainInput } from './explanation.service';

const openaiMock = { chat: { completions: { create: jest.fn() } } } as any;

const mk = (over: Partial<ExplainInput> = {}): ExplainInput => ({
  ingredientId: 1,
  ingredientName: '비타민D',
  verdict: 'OVER',
  totalCanonical: 41,
  unit: '㎍',
  upperLimit: 40,
  recommended: 5,
  percentOfRecommended: 820,
  reference: { source: 'KDRIs 2020', sourceUrl: 'http://x' } as any,
  ...over,
});

const llmReturns = (explanations: { ingredientId: number; explanation: string }[]) =>
  openaiMock.chat.completions.create.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ explanations }) } }],
  });

describe('ExplanationService.explainAll', () => {
  const svc = new ExplanationService(openaiMock);
  beforeEach(() => jest.clearAllMocks());

  it('uses a deterministic message for UNKNOWN without calling the LLM', async () => {
    const out = await svc.explainAll([
      mk({
        verdict: 'UNKNOWN',
        ingredientName: '셀레늄',
        totalCanonical: null,
        upperLimit: null,
        recommended: null,
        percentOfRecommended: null,
        reference: null,
      }),
    ]);
    expect(out.get(1)).toContain('확인 불가');
    expect(openaiMock.chat.completions.create).not.toHaveBeenCalled();
  });

  it('batches all grounded nutrients into a single LLM call', async () => {
    llmReturns([
      { ingredientId: 1, explanation: '41㎍로 상한 40㎍를 초과합니다. (KDRIs 2020)' },
      { ingredientId: 2, explanation: '권장의 67% 수준입니다. (KDRIs 2020)' },
    ]);
    const out = await svc.explainAll([
      mk({ ingredientId: 1 }),
      mk({
        ingredientId: 2,
        verdict: 'SAFE',
        totalCanonical: 30,
        upperLimit: 510,
        percentOfRecommended: 67,
      }),
    ]);
    expect(openaiMock.chat.completions.create).toHaveBeenCalledTimes(1);
    expect(out.get(1)).toContain('초과');
    expect(out.get(2)).toContain('67%');
  });

  it('falls back when the LLM explanation fails verification (hallucinated number)', async () => {
    llmReturns([{ ingredientId: 1, explanation: '하루 300mg 이상은 위험합니다.' }]);
    const out = await svc.explainAll([mk({ ingredientId: 1 })]);
    expect(out.get(1)).toContain('자동 설명을 생성하지 못했');
  });

  it('falls back for all nutrients without throwing when the LLM call errors', async () => {
    openaiMock.chat.completions.create.mockRejectedValue(new Error('401 no key'));
    const out = await svc.explainAll([mk({ ingredientId: 1 })]);
    expect(typeof out.get(1)).toBe('string');
    expect((out.get(1) ?? '').length).toBeGreaterThan(0);
  });

  it('grounds the prompt in provided numbers and source only', async () => {
    llmReturns([{ ingredientId: 1, explanation: '41㎍ 초과 (KDRIs 2020)' }]);
    await svc.explainAll([mk({ ingredientId: 1 })]);
    const prompt = JSON.stringify(
      openaiMock.chat.completions.create.mock.calls[0][0],
    );
    expect(prompt).toContain('41');
    expect(prompt).toContain('KDRIs 2020');
    expect(prompt).toMatch(/추측|제공된/);
  });
});
