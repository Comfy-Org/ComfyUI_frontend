import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const SDK_DOCS = 'https://docs.comfy.org/development/api-development/sdks'

const locales = [
  {
    name: 'en',
    path: '/api',
    ctaLabel: 'TRY THE COMFY SDK',
    integrationHeading: 'Integrate ComfyUI into the rest of your stack',
    stepsHeading: 'Three steps to production'
  },
  {
    name: 'zh-CN',
    path: '/zh-CN/api',
    ctaLabel: '试用 Comfy SDK',
    integrationHeading: '将 ComfyUI 集成到你的技术栈中',
    stepsHeading: '三步进入生产'
  }
] as const

function sectionWithHeading(page: Page, heading: string) {
  return page
    .locator('section')
    .filter({ has: page.getByRole('heading', { name: heading }) })
}

for (const locale of locales) {
  test.describe(`API page — ${locale.name} @smoke`, () => {
    test('the integration card and the steps row each own one SDK CTA', async ({
      page
    }) => {
      await page.goto(locale.path)

      const integrationCta = sectionWithHeading(
        page,
        locale.integrationHeading
      ).getByRole('link', { name: locale.ctaLabel })
      const stepsCta = sectionWithHeading(page, locale.stepsHeading).getByRole(
        'link',
        { name: locale.ctaLabel }
      )

      await expect(integrationCta).toHaveCount(1)
      await expect(stepsCta).toHaveCount(1)
      await expect(integrationCta).toHaveAttribute('href', SDK_DOCS)
      await expect(stepsCta).toHaveAttribute('href', SDK_DOCS)
    })
  })
}
