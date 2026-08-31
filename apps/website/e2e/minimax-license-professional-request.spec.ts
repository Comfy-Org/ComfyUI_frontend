import { expect } from '@playwright/test'

import { getRoutes } from '../src/config/routes'
import { test } from './fixtures/blockExternalMedia'

const PATH = '/minimax/license/professional-request'
const TITLE = 'Request MiniMax Professional License'
const HUBSPOT_FORM_ID = '40ef858c-374a-4958-8180-bfa54f0a67fb'
const HUBSPOT_SCRIPT_PATTERN = '**/js-na2.hsforms.net/**'

test.describe('MiniMax professional license request page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    // Stubbed so the assertions below cover our embed contract, not HubSpot's
    // availability. A real load-failure would blank the mount point entirely.
    await page.route(HUBSPOT_SCRIPT_PATTERN, (route) =>
      route.fulfill({ status: 200, contentType: 'text/javascript', body: '' })
    )
    await page.goto(PATH)
  })

  test('mounts the HubSpot form embed under the request heading', async ({
    page
  }) => {
    await expect(
      page.getByRole('heading', { level: 1, name: TITLE })
    ).toBeVisible()

    const embed = page.locator('.hs-form-html')
    await expect(embed).toHaveAttribute('data-form-id', HUBSPOT_FORM_ID)
    await expect(embed).toHaveAttribute('data-portal-id', '244637579')
    await expect(embed).toHaveAttribute('data-region', 'na2')
  })

  test('links back to the license page for the terms', async ({ page }) => {
    await expect(
      page.getByRole('link', { name: 'see what it includes' })
    ).toHaveAttribute('href', getRoutes('en').minimaxLicense)
  })
})
