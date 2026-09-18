import { expect } from '@playwright/test'

import { test } from './fixtures/workshopVisibility'

test('the row keeps a keyboard inside it when an arrow is spent', async ({
  page
}) => {
  await page.goto('/models/')
  const row = page.locator('div:has(> [data-testid="card-row-arrows"])').first()
  const forward = row.getByTestId('card-row-next')
  const back = row.getByTestId('card-row-prev')
  await expect(forward).toBeVisible()

  await forward.focus()
  await expect(forward).toBeFocused()

  // Reaching the far end spends the arrow the keyboard is standing on.
  await row
    .getByTestId('card-row')
    .evaluate((cards) => cards.scrollTo({ left: cards.scrollWidth }))

  await expect(forward).toHaveCount(0)
  await expect(back).toBeVisible()
  await expect(back).toBeFocused()
})
