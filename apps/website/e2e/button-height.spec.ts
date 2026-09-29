import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

// A button label wrapped in an element, rather than left as bare text, used to
// land in a box that reserved descender space the label never uses. The box was
// then taller than its own line, the button grew with it, and the label sat
// above the button's centre — on every button carrying an icon at once, which
// is why this is asserted over the page rather than per component.
test('a button label occupies no more height than its own line', async ({
  page
}) => {
  await page.goto('/download')

  const labels = await page.evaluate(() => {
    const measured = []

    for (const button of document.querySelectorAll('a, button')) {
      const style = getComputedStyle(button)
      if (!/flex/.test(style.display) || style.whiteSpace !== 'nowrap') continue

      const label = button.querySelector(':scope > span')
      if (!label) continue

      const lineHeight = parseFloat(getComputedStyle(label).lineHeight)
      if (!Number.isFinite(lineHeight)) continue

      measured.push({
        text: button.textContent.trim().replace(/\s+/g, ' '),
        height: label.getBoundingClientRect().height,
        lineHeight,
        wrapsAnElement: label.firstElementChild !== null
      })
    }

    return measured
  })

  // Only a label wrapped in an element ever reserved the extra space, so a run
  // that happened to collect none of those would pass without proving anything.
  expect(labels.filter((label) => label.wrapsAnElement).length).toBeGreaterThan(
    0
  )

  for (const label of labels) {
    expect(label.height, label.text).toBeCloseTo(label.lineHeight, 0)
  }
})
