import { expect } from '@playwright/test'

import en from '@/locales/en/main.json' with { type: 'json' }
import ja from '@/locales/ja/main.json' with { type: 'json' }
import zhCN from '@/locales/zh-CN/main.json' with { type: 'json' }
import { test } from './fixtures/blockExternalMedia'
import { expectIslandHydrated, waitForIsland } from './fixtures/islands'

const copyOnlyIn = {
  en: en.footer.location,
  'zh-CN': zhCN.footer.location,
  ja: ja.auth.confirmPassword.label
}

test.describe('Locale catalogs', () => {
  for (const { path, loaded } of [
    { path: '/', loaded: ['en'] },
    { path: '/zh-CN/', loaded: ['en', 'zh-CN'] },
    { path: '/ja/', loaded: ['en', 'ja'] }
  ]) {
    test(`${path} downloads only the ${loaded.join(' and ')} catalogs`, async ({
      page
    }) => {
      await page.addInitScript(() =>
        performance.setResourceTimingBufferSize(10_000)
      )
      await page.goto(path)
      await expectIslandHydrated(
        page,
        page.getByRole('navigation', { name: 'Main navigation' })
      )

      const downloaded = await page.evaluate(async (copies) => {
        const sources = await Promise.all(
          performance
            .getEntriesByType('resource')
            .map((entry) => new URL(entry.name))
            .filter(
              (url) =>
                url.origin === location.origin &&
                /\.(js|json)$/.test(url.pathname)
            )
            .map(async (url) => (await fetch(url)).text())
        )
        return Object.entries(copies)
          .filter(([, copy]) => sources.some((source) => source.includes(copy)))
          .map(([locale]) => locale)
      }, copyOnlyIn)
      expect(downloaded).toEqual(loaded)
    })
  }

  for (const { failure, status, body } of [
    { failure: 'an HTTP error', status: 503, body: '{}' },
    { failure: 'an invalid catalog', status: 200, body: '{"invalid":42}' }
  ]) {
    test(`recovers from ${failure} during a language switch`, async ({
      page,
      context
    }) => {
      const fullNavigations: string[] = []
      const pageErrors: string[] = []
      page.on('request', (request) => {
        if (request.isNavigationRequest()) fullNavigations.push(request.url())
      })
      page.on('pageerror', (error) => pageErrors.push(error.message))

      await page.goto('/cli/')
      const chineseLink = page
        .getByRole('contentinfo')
        .getByRole('link', { name: '简体中文' })
      await waitForIsland(page, chineseLink)
      await context.route(
        /\/_website\/main\.[^/]+\.json$/,
        (route) =>
          route.fulfill({ status, contentType: 'application/json', body }),
        { times: 1 }
      )

      await chineseLink.click()

      await expect(page).toHaveURL(/\/zh-CN\/cli\/$/)
      await waitForIsland(page, chineseLink)
      await expect(chineseLink).toHaveAttribute('aria-current', 'page')
      await expect(
        page
          .getByRole('contentinfo')
          .getByRole('link', { name: '工作流' })
          .first()
      ).toBeVisible()
      expect(fullNavigations.map((url) => new URL(url).pathname)).toEqual([
        '/cli/',
        '/zh-CN/cli/'
      ])
      expect(pageErrors).toEqual([])
    })
  }
})
