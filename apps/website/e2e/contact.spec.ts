import { expect } from '@playwright/test'

import type { Page } from '@playwright/test'

import { externalLinks } from '../src/config/routes'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

const PATH = '/contact'
const ZH_PATH = '/zh-CN/contact'
const SUPPORT_MAILTO = 'mailto:support@comfy.org'

// Scoped to the paragraph rather than the page: the site footer links the same
// Help Center URL, so a page-wide locator would match two elements.
function supportParagraph(page: Page) {
  return page
    .locator('p')
    .filter({ has: page.locator(`a[href="${SUPPORT_MAILTO}"]`) })
}

test.describe('Contact page support routing @smoke', () => {
  test('offers the Help Center and the support mailbox alongside the form', async ({
    page
  }) => {
    await page.goto(PATH)

    const support = supportParagraph(page)
    await expect(support).toHaveCount(1)
    await expect(support).toContainText(t('contact.form.supportLink'))
    await expect(
      support.getByRole('link', { name: t('contact.form.supportLinkCta') })
    ).toHaveAttribute('href', externalLinks.support)
    await expect(
      support.getByRole('link', { name: 'support@comfy.org' })
    ).toHaveAttribute('href', SUPPORT_MAILTO)
  })

  test('no longer routes support seekers to the docs site', async ({
    page
  }) => {
    await page.goto(PATH)

    await expect(
      supportParagraph(page).locator('a[href*="docs.comfy.org"]')
    ).toHaveCount(0)
  })

  test('routes to the same support channels in zh-CN', async ({ page }) => {
    await page.goto(ZH_PATH)

    const support = supportParagraph(page)
    await expect(support).toHaveCount(1)
    await expect(support).toContainText(t('contact.form.supportLink', 'zh-CN'))
    await expect(
      support.getByRole('link', {
        name: t('contact.form.supportLinkCta', 'zh-CN')
      })
    ).toHaveAttribute('href', externalLinks.support)
    await expect(
      support.getByRole('link', { name: 'support@comfy.org' })
    ).toHaveAttribute('href', SUPPORT_MAILTO)
  })
})
