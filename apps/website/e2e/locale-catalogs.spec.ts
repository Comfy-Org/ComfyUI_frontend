import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { expect } from '@playwright/test'

import { websiteRoot } from '@website/paths'

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
    { path: '/ja/', loaded: ['en', 'ja'] },
    { path: '/enterprise-msa/', loaded: ['en'] },
    { path: '/affiliates/terms/', loaded: ['en'] }
  ]) {
    test(`${path} downloads only the ${loaded.join(' and ')} catalogs`, async ({
      page
    }) => {
      const assetRequests: string[] = []
      page.on('request', (request) => assetRequests.push(request.url()))
      await page.goto(path)
      await expectIslandHydrated(
        page,
        page.getByRole('navigation', { name: 'Main navigation' })
      )

      const downloaded = await page.evaluate(
        async ({ copies, requests }) => {
          const assets = requests
            .map((name) => new URL(name))
            .filter(
              (url) =>
                url.origin === location.origin &&
                /^\/_website\/.*\.(js|json)$/.test(url.pathname)
            )
          const sources = await Promise.all(
            [...new Set(assets.map((url) => url.href))].map(async (href) => ({
              href,
              source: await (await fetch(href)).text()
            }))
          )
          return Object.entries(copies).flatMap(([locale, copy]) =>
            assets
              .filter((url) =>
                sources.some(
                  ({ href, source }) =>
                    href === url.href && source.includes(copy)
                )
              )
              .map((url) => ({ locale, path: url.pathname }))
          )
        },
        { copies: copyOnlyIn, requests: [...assetRequests] }
      )
      expect(
        downloaded.map(({ locale }) => locale),
        JSON.stringify(downloaded)
      ).toEqual(loaded)
    })
  }

  test('reuses the catalog preload when navigating within a language', async ({
    page
  }) => {
    const catalogRequests: string[] = []
    page.on('request', (request) => {
      if (/\/_website\/main\.[^/]+\.json$/.test(request.url()))
        catalogRequests.push(request.url())
    })
    await page.goto('/')
    const cliLink = page
      .getByRole('contentinfo')
      .getByRole('link', { name: 'Comfy CLI', exact: true })
    await waitForIsland(page, cliLink)
    const initialRequests = [...catalogRequests]

    await cliLink.click()
    await expect(page).toHaveURL(/\/cli\/$/)
    await waitForIsland(page, cliLink)

    expect(catalogRequests).toEqual(initialRequests)
  })

  test('retains only the incoming language catalog links', async ({ page }) => {
    const catalogRequests: string[] = []
    page.on('request', (request) => {
      if (/\/_website\/main\.[^/]+\.json$/.test(request.url()))
        catalogRequests.push(request.url())
    })
    await page.goto('/zh-CN/')
    const japaneseLink = page
      .getByRole('contentinfo')
      .getByRole('link', { name: '日本語', exact: true })
    await waitForIsland(page, japaneseLink)
    const initialRequestCount = catalogRequests.length
    await japaneseLink.click()
    await expect(page).toHaveURL(/\/ja\/$/)
    await waitForIsland(page, japaneseLink)

    await expect(page.locator('link[data-locale-catalog="en"]')).toHaveCount(1)
    await expect(page.locator('link[data-locale-catalog="ja"]')).toHaveCount(1)
    await expect(page.locator('link[data-locale-catalog="zh-CN"]')).toHaveCount(
      0
    )
    expect(catalogRequests.slice(initialRequestCount)).toHaveLength(1)
  })

  test('replaces a persisted catalog link when the incoming build changes its URL', async ({
    page,
    context
  }) => {
    await page.goto('/')
    const englishCatalog = page.locator('link[data-locale-catalog="en"]')
    const previousHref = await englishCatalog.getAttribute('href')
    if (!previousHref) throw new Error('Expected an English catalog URL')
    const nextHref = `${previousHref}?revision=next`
    const html = readFileSync(
      join(websiteRoot, 'dist/cli/index.html'),
      'utf8'
    ).replaceAll(previousHref, nextHref)
    await context.route('**/cli/', (route) =>
      route.fulfill({ contentType: 'text/html', body: html })
    )
    const cliLink = page
      .getByRole('contentinfo')
      .getByRole('link', { name: 'Comfy CLI', exact: true })
    await waitForIsland(page, cliLink)
    await cliLink.click()
    await expect(page).toHaveURL(/\/cli\/$/)
    await waitForIsland(page, cliLink)
    await expect(englishCatalog).toHaveAttribute('href', nextHref)
    await expect(englishCatalog).toHaveCount(1)
  })

  test('a stalled earlier catalog does not block a later language switch', async ({
    page,
    context
  }) => {
    const catalogRequested = Promise.withResolvers<void>()
    const releaseCatalog = Promise.withResolvers<void>()
    const fullNavigations: string[] = []
    page.on('request', (request) => {
      if (request.isNavigationRequest())
        fullNavigations.push(new URL(request.url()).pathname)
    })
    await page.goto('/')
    const footer = page.getByRole('contentinfo')
    const chineseLink = footer.getByRole('link', {
      name: '简体中文',
      exact: true
    })
    const japaneseLink = footer.getByRole('link', {
      name: '日本語',
      exact: true
    })
    await waitForIsland(page, chineseLink)
    await context.route(
      /\/_website\/main\.[^/]+\.json$/,
      async (route) => {
        catalogRequested.resolve()
        await releaseCatalog.promise
        await route.continue()
      },
      { times: 1 }
    )
    try {
      await chineseLink.click()
      await catalogRequested.promise
      await japaneseLink.click()
      await expect(page).toHaveURL(/\/ja\/$/)
      await waitForIsland(page, chineseLink)
      await chineseLink.click()
      await expect(page).toHaveURL(/\/zh-CN\/$/)
      await waitForIsland(page, chineseLink)
      expect(fullNavigations).toEqual(['/'])
    } finally {
      releaseCatalog.resolve()
    }
  })

  test('switching language before the locale module starts keeps the new page interactive', async ({
    page,
    context
  }) => {
    const moduleRequested = Promise.withResolvers<void>()
    const releaseModule = Promise.withResolvers<void>()
    const releaseDocument = Promise.withResolvers<void>()
    const fullNavigations: string[] = []
    const errors: string[] = []
    page.on('request', (request) => {
      if (request.isNavigationRequest()) fullNavigations.push(request.url())
    })
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
      document.addEventListener('astro:before-preparation', () => {
        document.documentElement.dataset.preparationStarted = 'true'
      })
    })
    await context.route(
      /\/_website\/translations\.[^/]+\.js$/,
      async (route) => {
        moduleRequested.resolve()
        await releaseModule.promise
        await route.continue()
      }
    )
    await context.route(/\/zh-CN\/cli\/$/, async (route) => {
      await releaseDocument.promise
      await route.continue()
    })

    try {
      await page.goto('/cli/', { waitUntil: 'commit' })
      await moduleRequested.promise
      await page.waitForFunction(() => typeof history.state?.index === 'number')
      await page
        .getByRole('contentinfo')
        .getByRole('link', { name: '简体中文' })
        .click()
      await expect(page.locator('html')).toHaveAttribute(
        'data-preparation-started',
        'true'
      )
      releaseModule.resolve()
      await waitForIsland(
        page,
        page.getByRole('button', { name: 'Toggle menu' })
      )
      releaseDocument.resolve()

      await expect(page).toHaveURL(/\/zh-CN\/cli\/$/)
      await expectIslandHydrated(
        page,
        page.getByRole('navigation', { name: 'Main navigation' })
      )
      expect(errors).toEqual([])
      const menuButton = page.getByRole('button', { name: '切换菜单' })
      await waitForIsland(page, menuButton)
      await menuButton.click()
      await expect(page.getByRole('dialog', { name: '菜单' })).toBeVisible()
      expect(errors).toEqual([])
      expect(fullNavigations.map((url) => new URL(url).pathname)).toEqual([
        '/cli/'
      ])
    } finally {
      releaseModule.resolve()
      releaseDocument.resolve()
    }
  })

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
      document.addEventListener('astro:before-preparation', (event) => {
        const loadDocument = event.loader
        event.loader = async () => {
          await loadDocument()
          document.documentElement.dataset.documentPrepared = 'true'
        }
      })
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
      const switchLanguage = page
        .getByRole('contentinfo')
        .getByRole('link', { name: '简体中文' })
        .click()
      await expect(page.locator('html')).toHaveAttribute(
        'data-document-prepared',
        'true'
      )
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

  for (const { failure, path, status, button, dialog } of [
    {
      failure: 'an HTTP error',
      path: '/zh-CN/cli/',
      status: 503,
      button: '切换菜单',
      dialog: '菜单'
    },
    {
      failure: 'empty English',
      path: '/cli/',
      status: 200,
      button: 'Toggle menu',
      dialog: 'Menu'
    },
    {
      failure: 'empty active',
      path: '/zh-CN/cli/',
      status: 200,
      button: '切换菜单',
      dialog: '菜单'
    }
  ]) {
    test(`${failure} initial catalog recovers through the bundled catalog`, async ({
      page,
      context
    }) => {
      await page.setViewportSize({ width: 390, height: 844 })
      await context.route(/\/_website\/main\.[^/]+\.json$/, (route) =>
        route.fulfill({
          status,
          contentType: 'application/json',
          body: '{}'
        })
      )

      await page.goto(path)
      const menuButton = page.getByRole('button', { name: button })
      await waitForIsland(page, menuButton)
      await menuButton.click()
      await expect(
        page.getByRole('dialog', { name: dialog, exact: true })
      ).toBeVisible()
    })
  }

  test('a stalled initial catalog recovers through the bundled catalog', async ({
    page,
    context
  }) => {
    const releaseCatalogs = Promise.withResolvers<void>()
    await page.setViewportSize({ width: 390, height: 844 })
    await context.route(/\/_website\/main\.[^/]+\.json$/, async (route) => {
      await releaseCatalogs.promise
      await route.continue()
    })
    try {
      await page.goto('/zh-CN/cli/', { waitUntil: 'commit' })
      const menuButton = page.getByRole('button', { name: '切换菜单' })
      await expect(async () => {
        await expectIslandHydrated(page, menuButton)
      }).toPass({ timeout: 15_000 })
      await menuButton.click()
      await expect(
        page.getByRole('dialog', { name: '菜单', exact: true })
      ).toBeVisible()
    } finally {
      releaseCatalogs.resolve()
    }
  })

  test('a timed-out navigation catalog recovers through a full-page retry', async ({
    page,
    context
  }) => {
    const releaseCatalog = Promise.withResolvers<void>()
    const fullNavigations: string[] = []
    page.on('request', (request) => {
      if (request.isNavigationRequest())
        fullNavigations.push(new URL(request.url()).pathname)
    })
    await page.goto('/cli/')
    const chineseLink = page
      .getByRole('contentinfo')
      .getByRole('link', { name: '简体中文', exact: true })
    await waitForIsland(page, chineseLink)
    await context.route(
      /\/_website\/main\.[^/]+\.json$/,
      async (route) => {
        await releaseCatalog.promise
        await route.continue()
      },
      { times: 1 }
    )
    try {
      await chineseLink.click()
      await expect(page).toHaveURL(/\/zh-CN\/cli\/$/, { timeout: 15_000 })
      await waitForIsland(page, chineseLink)
      expect(fullNavigations).toEqual(['/cli/', '/zh-CN/cli/'])
      await expect(
        page
          .getByRole('contentinfo')
          .getByRole('link', { name: '工作流', exact: true })
          .first()
      ).toBeVisible()
    } finally {
      releaseCatalog.resolve()
    }
  })

  for (const { failure, status, body } of [
    { failure: 'an HTTP error', status: 503, body: '{}' },
    { failure: 'an empty catalog', status: 200, body: '{}' },
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
