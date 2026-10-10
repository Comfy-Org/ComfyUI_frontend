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

// A touch screen can neither hover nor focus, so the row could only ever show
// its arrows there or never show them. It never shows them: the finger scrolls
// the row, and the next card cut off at the edge says there is more.
//
// At 320 the row is narrower than a flat card, so without the width cap the
// first card is the one the edge cuts and no second card shows at all — the
// hint disappears exactly where it is the only one left.
test('a touch screen gets the cut-off next card instead of arrows @mobile', async ({
  page
}) => {
  await page.setViewportSize({ width: 320, height: 800 })
  await page.goto('/hub/models/')
  const row = page.getByTestId('section-generate-images')
  const cards = row.getByTestId('card-row')
  await expect(cards).toBeVisible()
  await expect(row.getByTestId('card-row-arrows')).toBeHidden()

  const cut = await cards.evaluate((list) => {
    const edge = list.getBoundingClientRect().right
    const index = [...list.children].findIndex((card) => {
      const { left, right } = card.getBoundingClientRect()
      return left < edge && right > edge
    })
    if (index === -1) return null
    const { left, width } = list.children[index].getBoundingClientRect()
    return { index, showing: Math.round(edge - left), width: Math.round(width) }
  })

  // A whole card before it, and only a slice of it: that slice is the hint.
  expect(cut).not.toBeNull()
  expect(cut?.index).toBeGreaterThan(0)
  expect(cut?.showing).toBeGreaterThan(0)
  expect(cut?.showing).toBeLessThan(cut?.width ?? 0)
})
