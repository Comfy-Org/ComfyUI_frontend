import { expect } from '@playwright/test'

import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const HUBSPOT_SCRIPT_SRC =
  'https://js-na2.hsforms.net/forms/embed/developer/244637579.js'
const HUBSPOT_SCRIPT_PATTERN = '**/js-na2.hsforms.net/**'

// Locale → form ID is wired in FormSection.vue; a swapped ID would route
// leads to the wrong HubSpot pipeline while every page still renders.
const CONTACT_FORMS = [
  {
    locale: 'en',
    path: '/contact',
    formId: '94e05eab-1373-47f7-ab5e-d84f9e6aa262'
  },
  {
    locale: 'zh-CN',
    path: '/zh-CN/contact',
    formId: '6885750c-02ef-4aa2-ba0d-213be9cccf93'
  }
] as const

test.describe('Contact form embed @smoke', () => {
  for (const { locale, path, formId } of CONTACT_FORMS) {
    test(`mounts the ${locale} HubSpot form`, async ({ page }) => {
      // Stubbed so the assertions below cover our embed contract, not
      // HubSpot's availability.
      await page.route(HUBSPOT_SCRIPT_PATTERN, (route) =>
        route.fulfill({ status: 200, contentType: 'text/javascript', body: '' })
      )
      await page.goto(path)

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: t('contact.form.heading', locale)
        })
      ).toBeVisible()

      await expect(page.locator('.hs-form-html')).toHaveAttribute(
        'data-form-id',
        formId
      )

      await expect(page.locator('script#hubspot-form-embed')).toHaveAttribute(
        'src',
        HUBSPOT_SCRIPT_SRC
      )
    })
  }
})

// The logo bar is rendered only by FormSection now; losing it there would
// strip both locales of social proof while every page still renders.
test.describe('Contact social proof @smoke', () => {
  // The hero entrance tween translates the image, so geometry is only stable
  // once useHeroAnimation opts out.
  test.use({ contextOptions: { reducedMotion: 'reduce' } })

  for (const { locale, path } of CONTACT_FORMS) {
    test(`anchors the ${locale} logo bar beneath the hero image`, async ({
      page
    }) => {
      await page.goto(path)

      const formSection = page.locator('section', {
        has: page.getByRole('heading', {
          level: 1,
          name: t('contact.form.heading', locale)
        })
      })

      // The testid sits on the w-max marquee row, so measure its section.
      const bar = formSection
        .locator('section')
        .filter({ has: page.getByTestId('social-proof-desktop') })
      await expect(bar).toHaveCount(1)
      await expect(page.getByTestId('social-proof-desktop')).toHaveCount(1)

      const image = formSection.locator('img').first()
      const columns = formSection.locator('> div')

      await expect
        .poll(async () => {
          const [imageBox, barBox, leftBox, rightBox] = await Promise.all([
            image.boundingBox(),
            bar.boundingBox(),
            columns.nth(0).boundingBox(),
            columns.nth(1).boundingBox()
          ])
          if (!imageBox || !barBox || !leftBox || !rightBox) return null
          return {
            barBelowImage: barBox.y >= imageBox.y + imageBox.height,
            barTracksImage:
              Math.abs(barBox.x - imageBox.x) < 1 &&
              Math.abs(barBox.width - imageBox.width) < 1,
            evenColumns: Math.abs(leftBox.width - rightBox.width) < 1
          }
        })
        .toEqual({
          barBelowImage: true,
          barTracksImage: true,
          evenColumns: true
        })
    })
  }
})
