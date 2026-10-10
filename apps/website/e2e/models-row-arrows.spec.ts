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

// A touch screen can neither hover nor focus, so the row never hides its
// arrows there and a spent one sits in plain sight. It has to swallow the tap:
// handing it to the card underneath opens a model the reader did not ask for.
test('a spent arrow swallows the tap on a touch screen @mobile', async ({
  page
}) => {
  await page.goto('/hub/models/')
  const row = page.getByTestId('section-generate-images')
  const cards = row.getByTestId('card-row')
  const back = row.getByTestId('card-row-prev')
  await expect(back).toHaveAttribute('aria-disabled', 'true')
  await back.scrollIntoViewIfNeeded()
  const restingScroll = await cards.evaluate((el) => el.scrollLeft)

  // A finger landing on the spot, rather than a tap aimed at the control:
  // Playwright refuses to act on an `aria-disabled` button, which is the very
  // thing the reader can still touch.
  const spot = await back.boundingBox()
  if (!spot) throw new Error('the spent arrow has no box to tap')
  await page.touchscreen.tap(spot.x + spot.width / 2, spot.y + spot.height / 2)

  await expect(page).toHaveURL(/\/hub\/models\/$/)
  expect(await cards.evaluate((el) => el.scrollLeft)).toBe(restingScroll)
})
