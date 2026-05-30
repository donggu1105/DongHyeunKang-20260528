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
    // child band (ageMonths=72 → 만 6–8세) must carry the ▸ highlight marker;
    // fails if isChild highlight logic regresses (e.g. always false).
    await expect.element(page.getByText(/▸\s*만\s6–8세/u)).toBeVisible();
  });

  it('escapes overflow:hidden ancestors via portal so the popover is not clipped', async () => {
    // Repro of the real bug: the trigger lived inside `overflow:hidden` (truncate span +
    // card button), which clipped the absolutely-positioned popover to ~0 visible height.
    // Box is wide/short enough to SHOW the trigger but CLIP a non-portaled popover.
    await render(
      <div data-testid="clip-box" style={{ height: 24, overflow: 'hidden', width: 240 }}>
        <NutrientInfo ageMonths={72} ingredientName="비타민D">
          비타민D
        </NutrientInfo>
      </div>,
    );
    // Open via focus (reliable; avoids clicking a clipped glyph).
    page
      .getByRole('button', { name: /비타민D/u })
      .element()
      .focus();
    await expect.element(page.getByRole('tooltip')).toBeVisible();
    await expect.element(page.getByText('만 6–8세')).toBeVisible();
    // The popover must NOT be nested inside the overflow:hidden box — it must portal out
    // (to document.body), otherwise it is clipped and the user sees nothing.
    expect(page.getByRole('tooltip').element().closest('[data-testid="clip-box"]')).toBeNull();
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
    // Chromium prunes the nested role=button from the a11y tree (button-in-button).
    // Select the trigger's marker by stable testid (not the 🔍 emoji text): the wide
    // inline trigger span only hit-tests on glyph pixels, so a click on it lands in
    // leading owned by the parent <button>; the fully-filled marker is reliable.
    await page.getByTestId('nutrient-info-trigger').click();
    expect(onParent).not.toHaveBeenCalled();
  });
});
