import { fileURLToPath } from 'node:url'

import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForPpFormulaLight } from './fixtures/visualFonts'

const ppFormulaLightPath = fileURLToPath(
  new URL('../public/fonts/PPFormula-Light.woff2', import.meta.url)
)

test('waits for the page font without overriding other text', async ({
  context,
  page
}) => {
  const fontRequested = Promise.withResolvers<void>()
  const releaseFont = Promise.withResolvers<void>()

  await context.route('**/fonts/PPFormula-Light.woff2', async (route) => {
    fontRequested.resolve()
    await releaseFont.promise
    await route.fulfill({
      path: ppFormulaLightPath,
      contentType: 'font/woff2'
    })
  })
  await context.route('**/__visual-font-test', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `
        <style>
          @font-face {
            font-family: 'PP Formula';
            src: url('/fonts/PPFormula-Light.woff2') format('woff2');
            font-weight: 300;
            font-display: block;
          }
          body { font: 300 48px sans-serif; }
          .price { font-family: 'PP Formula', sans-serif; }
        </style>
        <span data-testid="price" class="price font-formula font-light">$16</span>
        <span data-testid="fallback">$16</span>
        <span data-testid="inherited" class="font-formula font-light">$16</span>
      `
    })
  )

  await page.goto('/__visual-font-test', { waitUntil: 'domcontentloaded' })
  const stabilization = waitForPpFormulaLight(page)
  await fontRequested.promise
  releaseFont.resolve()
  await stabilization

  const formulaWidth = await page
    .getByTestId('price')
    .evaluate((element) => element.getBoundingClientRect().width)
  const fallbackWidth = await page
    .getByTestId('fallback')
    .evaluate((element) => element.getBoundingClientRect().width)

  expect(formulaWidth).toBeGreaterThan(fallbackWidth)
  const inheritedWidth = await page
    .getByTestId('inherited')
    .evaluate((element) => element.getBoundingClientRect().width)
  expect(inheritedWidth).toBe(fallbackWidth)
})
