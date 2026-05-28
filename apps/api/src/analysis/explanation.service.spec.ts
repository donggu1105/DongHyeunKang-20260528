import { ExplanationService } from './explanation.service';

const openaiMock = { chat: { completions: { create: jest.fn() } } } as any;

describe('ExplanationService', () => {
  const svc = new ExplanationService(openaiMock);
  beforeEach(() => jest.clearAllMocks());

  it('does NOT call the LLM for UNKNOWN nutrients', async () => {
    const out = await svc.explain({ ingredientName: '셀레늄', verdict: 'UNKNOWN', totalCanonical: null, unit: '', upperLimit: null, percentOfRecommended: null, reference: null });
    expect(out).toContain('확인 불가');
    expect(openaiMock.chat.completions.create).not.toHaveBeenCalled();
  });

  it('includes only grounded numbers in the prompt', async () => {
    openaiMock.chat.completions.create.mockResolvedValue({ choices: [{ message: { content: '설명' } }] });
    await svc.explain({ ingredientName: '비타민D', verdict: 'OVER', totalCanonical: 41, unit: '㎍', upperLimit: 40, percentOfRecommended: 820, reference: { source: 'KDRIs 2020', sourceUrl: 'http://x' } as any });
    const prompt = JSON.stringify(openaiMock.chat.completions.create.mock.calls[0][0]);
    expect(prompt).toContain('41');
    expect(prompt).toContain('KDRIs 2020');
    expect(prompt).toMatch(/추측 금지|제공된/);
  });
});
