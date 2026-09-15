import { expect } from '@playwright/test'
import type {} from '@vercel/analytics'

import { test } from './fixtures/blockExternalMedia'

test.beforeEach(async ({ context }) => {
  await context.route('**/_vercel/insights/script.js', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: '' })
  )
})

for (const locale of ['zh-CN', 'ja']) {
  test(`${locale} analytics keeps the locale through client navigation`, async ({
    page
  }) => {
    await page.goto(`/${locale}/about/`)

    await expect
      .poll(() =>
        page.evaluate(() =>
          window.vaq?.filter(([event]) => event === 'pageview')
        )
      )
      .toEqual([
        ['pageview', { path: `/${locale}/about/`, route: `/${locale}/about/` }]
      ])

    await page
      .getByRole('navigation', { name: 'Main', exact: true })
      .getByRole('link', {
        name: locale === 'ja' ? '料金' : '价格',
        exact: true
      })
      .click()

    await expect(page).toHaveURL(new RegExp(`/${locale}/pricing/?$`))
    const pathname = new URL(page.url()).pathname
    await expect
      .poll(() =>
        page.evaluate(() =>
          window.vaq?.filter(([event]) => event === 'pageview')
        )
      )
      .toEqual([
        ['pageview', { path: `/${locale}/about/`, route: `/${locale}/about/` }],
        ['pageview', { path: pathname, route: pathname }]
      ])
  })
}
