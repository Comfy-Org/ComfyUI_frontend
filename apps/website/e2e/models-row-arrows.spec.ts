import { expect } from '@playwright/test'

import { test } from './fixtures/workshopVisibility'

test('the row keeps a keyboard on the arrow it is standing on', async ({
  page
}) => {
  await page.goto('/hub/models/')
  const row = page.getByTestId('section-generate-images')
  const forward = row.getByTestId('carousel-next')
  const back = row.getByTestId('carousel-prev')
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
