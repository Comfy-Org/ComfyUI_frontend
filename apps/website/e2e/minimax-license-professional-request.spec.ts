import { expect } from '@playwright/test'

import { getRoutes } from '../src/config/routes'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH = getRoutes('en').minimaxLicenseProfessionalRequest
const TITLE = t('minimaxLicense.professionalRequest.title', 'en')
const HUBSPOT_FORM_ID = '40ef858c-374a-4958-8180-bfa54f0a67fb'
const HUBSPOT_SCRIPT_SRC =
  'https://js-na2.hsforms.net/forms/embed/developer/244637579.js'
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

    await expect(page.locator('.hs-form-html')).toHaveAttribute(
      'data-form-id',
      HUBSPOT_FORM_ID
    )

    await expect(page.locator('script#hubspot-form-embed')).toHaveAttribute(
      'src',
      HUBSPOT_SCRIPT_SRC
    )
  })

  test('links back to the license page for the terms', async ({ page }) => {
    await expect(
      page.getByRole('link', {
        name: t('minimaxLicense.professionalRequest.introCta', 'en')
      })
    ).toHaveAttribute('href', getRoutes('en').minimaxLicense)
  })
})
