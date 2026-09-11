import { fileURLToPath } from 'node:url'

import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { stabilizePpFormulaLight } from './fixtures/visualFonts'

const ppFormulaLightPath = fileURLToPath(
  new URL('../public/fonts/PPFormula-Light.woff2', import.meta.url)
)

test('stabilizes PP Formula Light while its response is delayed', async ({
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
        <span class="font-formula font-light" style="font-size: 48px; font-weight: 300">$16</span>
        <span data-testid="fallback" style="font: 300 48px sans-serif">$16</span>
      `
    })
  )

  await page.goto('/__visual-font-test')
  const stabilization = stabilizePpFormulaLight(page)
  await fontRequested.promise
  releaseFont.resolve()
  await stabilization

  const formulaWidth = await page
    .getByText('$16', { exact: true })
    .first()
    .evaluate((element) => element.getBoundingClientRect().width)
  const fallbackWidth = await page
    .getByTestId('fallback')
    .evaluate((element) => element.getBoundingClientRect().width)

  expect(formulaWidth).toBeGreaterThan(fallbackWidth)
})
