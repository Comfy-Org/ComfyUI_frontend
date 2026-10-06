import { expect } from '@playwright/test'

import en from '@/locales/en/main.json' with { type: 'json' }
import ja from '@/locales/ja/main.json' with { type: 'json' }
import zhCN from '@/locales/zh-CN/main.json' with { type: 'json' }
import { test } from './fixtures/blockExternalMedia'
import { expectIslandHydrated } from './fixtures/islands'

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
})
