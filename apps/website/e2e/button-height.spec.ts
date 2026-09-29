import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

// A button label wrapped in an element, rather than left as bare text, used to
// land in a box that reserved descender space the label never uses. The box was
// then taller than its text lines, the button grew with it, and the label sat
// above the button's centre — on every button carrying an icon at once, which
// is why this is asserted over the page rather than per component.
test('a button label occupies no more height than its text lines', async ({
  page
}) => {
  await page.goto('/download')
  await expect(
    page.getByRole('link', { name: /^DOWNLOAD DESKTOP .+/ }).first()
  ).toBeVisible()

  const labels = await page.evaluate(() => {
    function measureTextHeight(label: Element) {
      const lines = new Map<number, number>()
      const textNodes = document.createTreeWalker(label, NodeFilter.SHOW_TEXT)
      while (textNodes.nextNode()) {
        const node = textNodes.currentNode
        if (!node.textContent?.trim() || !node.parentElement) continue
        const lineHeight = parseFloat(
          getComputedStyle(node.parentElement).lineHeight
        )
        if (!Number.isFinite(lineHeight)) continue
        const range = document.createRange()
        range.selectNodeContents(node)
        for (const rect of range.getClientRects()) {
          if (rect.width > 0 && rect.height > 0) lines.set(rect.top, lineHeight)
        }
      }
      return [...lines.values()].reduce((sum, height) => sum + height, 0)
    }

    const measured = []

    for (const button of document.querySelectorAll('a, button')) {
      const style = getComputedStyle(button)
      if (!/flex/.test(style.display) || style.whiteSpace !== 'nowrap') continue

      const label = button.querySelector(':scope > span')
      if (!label) continue

      const lineHeight = measureTextHeight(label)
      if (lineHeight === 0) continue

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

  expect(
    labels.map(({ text, height, lineHeight }) => ({
      text,
      excess: Math.round(height - lineHeight)
    }))
  ).toEqual(labels.map(({ text }) => ({ text, excess: 0 })))
})
