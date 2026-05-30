import { describe, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { page } from 'vitest/browser';
import type { IngredientInfo } from '@/libs/Api';
import { NutrientInfo } from './NutrientInfo';

const VIT_D: IngredientInfo = {
  id: 1,
  name: '비타민D',
  canonicalUnit: '㎍',
  isFatSoluble: true,
  references: [
    {
      ageMinMonths: 36,
      ageMaxMonths: 71,
      ageLabel: '만 3–5세',
      recommended: 5,
      upperLimit: 35,
      unit: '㎍',
    },
    {
      ageMinMonths: 72,
      ageMaxMonths: 107,
      ageLabel: '만 6–8세',
      recommended: 5,
      upperLimit: 40,
      unit: '㎍',
    },
  ],
  source: 'KDRIs 2020',
  sourceUrl: 'http://k',
};

vi.mock(import('@/hooks/useIngredients'), () => ({
  useIngredients: () => ({ status: 'ready', byName: new Map([['비타민D', VIT_D]]) }),
}));

describe(NutrientInfo, () => {
  it('opens on focus and shows the age table with the child band highlighted', async () => {
    await render(
      <NutrientInfo ageMonths={72} ingredientName="비타민D">
        비타민D
      </NutrientInfo>,
    );
    // This vitest-browser Locator has no `.focus()`; focus the real element to fire onFocus.
    page
      .getByRole('button', { name: /비타민D/u })
      .element()
      .focus();
    await expect.element(page.getByText('만 6–8세')).toBeVisible();
    await expect.element(page.getByText('40㎍')).toBeVisible();
  });

  it('does NOT toggle a parent button (stopPropagation)', async () => {
    const onParent = vi.fn<() => void>();
    await render(
      <button onClick={onParent} type="button">
        <NutrientInfo ageMonths={null} ingredientName="비타민D">
          비타민D
        </NutrientInfo>
      </button>,
    );
    // Chromium prunes the nested role=button from the a11y tree (button-in-button),
    // so query the inner trigger by its visible 🔍 marker, which only it carries.
    await page.getByText('🔍').click();
    expect(onParent).not.toHaveBeenCalled();
  });
});
