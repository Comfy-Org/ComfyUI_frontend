import { expect } from '@playwright/test'

import { test } from './fixtures/workshopVisibility'

test('the row keeps a keyboard on the arrow it is standing on', async ({
  page
}) => {
  await page.goto('/hub/models/')
  const row = page.getByTestId('section-generate-images')
  const forward = row.getByTestId('card-row-next')
  const back = row.getByTestId('card-row-prev')
  await expect(forward).toBeVisible()
  await expect(back).toHaveAttribute('aria-disabled', 'true')

  await forward.focus()
  await expect(forward).toBeFocused()

  // Reaching the far end spends the arrow the keyboard is standing on. It is
  // dimmed rather than taken away, so the reader keeps their place.
  await row
    .getByTestId('card-row')
    .evaluate((cards) => cards.scrollTo({ left: cards.scrollWidth }))

  await expect(forward).toHaveAttribute('aria-disabled', 'true')
  await expect(forward).toBeFocused()
  await expect(back).not.toHaveAttribute('aria-disabled')
})

test('a spent arrow hands the strip it covers back to the card', async ({
  page
}) => {
  await page.goto('/hub/models/')
  const row = page.getByTestId('section-generate-images')
  const back = row.getByTestId('card-row-prev')
  await expect(back).toHaveAttribute('aria-disabled', 'true')
  await back.scrollIntoViewIfNeeded()

  const underTheSpentArrow = await back.evaluate((arrow) => {
    const { right, top, bottom } = arrow.getBoundingClientRect()
    const hit = document.elementFromPoint(right - 1, (top + bottom) / 2)
    const owner = hit?.closest(
      '[data-testid="workshop-model-card"], [data-testid="card-row-prev"]'
    )
    return owner?.getAttribute('data-testid') ?? null
  })

  expect(underTheSpentArrow).toBe('workshop-model-card')
})
