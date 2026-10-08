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

  test('switching language before the first catalog loads keeps the new page interactive', async ({
    page,
    context
  }) => {
    const releaseCatalogs = Promise.withResolvers<void>()
    const errors: string[] = []
    page.on('console', (message) => {
      if (
        /catalog|setup function|hydration|t is not a function/i.test(
          message.text()
        )
      )
        errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => {
      const fetch = window.fetch.bind(window)
      window.fetch = (...args) => {
        const [resource] = args
        if (
          typeof resource === 'string' &&
          /\/main\.[^/]+\.json$/.test(resource)
        )
          document.documentElement.dataset.catalogRequested = 'true'
        return fetch(...args)
      }
    })
    await context.route(/\/_website\/main\.[^/]+\.json$/, async (route) => {
      await releaseCatalogs.promise
      await route.continue()
    })

    try {
      await page.goto('/cli/', { waitUntil: 'commit' })
      await expect(page.locator('html')).toHaveAttribute(
        'data-catalog-requested',
        'true'
      )
      const targetPage = page.waitForResponse(/\/zh-CN\/cli\/$/)
      const switchLanguage = page
        .getByRole('contentinfo')
        .getByRole('link', { name: '简体中文' })
        .click()
      await targetPage
      releaseCatalogs.resolve()
      await switchLanguage

      await expect(page).toHaveURL(/\/zh-CN\/cli\/$/)
      const menuButton = page.getByRole('button', { name: '切换菜单' })
      await expect(menuButton).toBeVisible()
      await waitForIsland(page, menuButton)
      await menuButton.click()
      await expect(page.getByRole('dialog', { name: '菜单' })).toBeVisible()
      expect(errors).toEqual([])
    } finally {
      releaseCatalogs.resolve()
    }
  })

  test('a failed initial catalog request recovers through the bundled catalog', async ({
    page,
    context
  }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await context.route(/\/_website\/main\.[^/]+\.json$/, (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{}'
      })
    )

    await page.goto('/zh-CN/cli/')
    const menuButton = page.getByRole('button', { name: '切换菜单' })
    await waitForIsland(page, menuButton)
    await menuButton.click()
    await expect(page.getByRole('dialog', { name: '菜单' })).toBeVisible()
  })

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
