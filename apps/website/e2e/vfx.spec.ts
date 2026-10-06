import { expect } from '@playwright/test'

import { vfxFaqs, vfxTasks, vfxWorkflows } from '@/data/vfx'
import { t } from '@/i18n/translations'
import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

const locales = [
  { locale: 'en', path: '/vfx', contact: '/contact/' },
  { locale: 'zh-CN', path: '/zh-CN/vfx', contact: '/zh-CN/contact/' }
] as const

for (const { locale, path, contact } of locales) {
  test.describe(`VFX landing page (${locale})`, () => {
    test('responds 200, has the localized title, and is noindex', async ({
      page
    }) => {
      const response = await page.goto(path)
      expect(response?.status()).toBe(200)
      await expect(page).toHaveTitle(t('vfx.meta.title', {}, { locale }))
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
        'content',
        /noindex/
      )
    })

    test('hero has one primary CTA to the contact form and a video', async ({
      page
    }) => {
      await page.goto(path)
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        t('vfx.hero.title', {}, { locale }).split('\n')[0]
      )
      const cta = page.getByRole('link', {
        name: t('vfx.hero.cta', {}, { locale })
      })
      await expect(cta.first()).toHaveAttribute('href', contact)
      await expect(
        page.getByLabel(t('vfx.hero.videoLabel', {}, { locale }))
      ).toBeAttached()
    })

    test('lists every VFX task with its tutorial or contact link', async ({
      page
    }) => {
      await page.goto(path)
      for (const task of vfxTasks(locale)) {
        await expect(
          page.getByRole('article').getByRole('heading', {
            name: task.title,
            exact: true
          })
        ).toBeVisible()
      }
      await expect(
        page.getByRole('link', {
          name: t('vfx.tasks.watchCta', {}, { locale }),
          exact: true
        })
      ).toHaveCount(5)
    })

    test('links ready-to-use workflows in new tabs', async ({ page }) => {
      await page.goto(path)
      for (const workflow of vfxWorkflows(locale)) {
        await expect(
          page.getByRole('link', { name: workflow.title })
        ).toHaveAttribute('href', workflow.href)
      }
    })

    test('FAQ expands and the page closes on the contact CTA', async ({
      page
    }) => {
      await page.goto(path)
      const [first] = vfxFaqs(locale)
      const question = page.getByRole('button', { name: first.question })
      await waitForIsland(page, question)
      await question.click()
      await expect(question).toHaveAttribute('aria-expanded', 'true')

      await expect(
        page
          .locator('[data-vfx-cta]')
          .last()
          .getByRole('link', { name: t('vfx.closing.cta', {}, { locale }) })
      ).toHaveAttribute('href', contact)
    })

    test('has no Download or Try Cloud call to action in the hero or closing sections', async ({
      page
    }) => {
      await page.goto(path)
      await expect(
        page.locator('[data-vfx-cta]').getByRole('link', {
          name: /download|try .*cloud|免费试用|下载/i
        })
      ).toHaveCount(0)
    })
  })
}

test('the VFX page stays out of the sitemap, the footer, and the navigation', async ({
  page
}) => {
  await page.goto('/')
  await expect(page.locator('footer a[href="/vfx/"]')).toHaveCount(0)
  await expect(page.locator('header a[href="/vfx/"]')).toHaveCount(0)
})
