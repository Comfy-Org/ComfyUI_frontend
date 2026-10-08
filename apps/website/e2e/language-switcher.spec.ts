import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

// hreflang drops noindex pages from their cluster and the switcher deliberately
// does not, so only a built noindex page proves that divergence and that the
// footer wires the switcher up at all.
const noindexTwins = [
  { path: '/privacy-policy/', label: 'Language', own: 'English' },
  { path: '/zh-CN/privacy-policy/', label: '语言', own: '简体中文' }
]

test.describe('Footer language switcher', () => {
  test('switching from English to Chinese shows the Chinese page', async ({
    page
  }) => {
    const pageErrors: string[] = []
    page.on('pageerror', (error) => pageErrors.push(error.message))

    await page.goto('/cli/')
    const footer = page.getByRole('contentinfo')
    await footer.getByRole('link', { name: '简体中文' }).click()

    await expect(page).toHaveURL(/\/zh-CN\/cli\/$/)
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh-CN')

    const chinese = footer.getByRole('link', { name: '简体中文' })
    await waitForIsland(page, chinese)
    await expect(chinese).toHaveAttribute('aria-current', 'page')
    await expect(
      footer.getByRole('link', { name: '工作流' }).first()
    ).toBeVisible()
    expect(pageErrors).toEqual([])
  })

  for (const { path, label, own } of noindexTwins) {
    test(`a noindex page keeps its language links (${path})`, async ({
      page
    }) => {
      await page.goto(path)
      const languages = page
        .getByRole('contentinfo')
        .getByRole('navigation', { name: label })

      await expect(languages.getByRole('link')).toHaveText([
        'English',
        '简体中文'
      ])
      await expect(
        languages.getByRole('link', { name: 'English' })
      ).toHaveAttribute('href', '/privacy-policy/')
      await expect(
        languages.getByRole('link', { name: '简体中文' })
      ).toHaveAttribute('href', '/zh-CN/privacy-policy/')

      const current = languages.locator('[aria-current]')
      await expect(current).toHaveCount(1)
      await expect(current).toHaveAttribute('aria-current', 'page')
      await expect(current).toHaveText(own)
      await expect(current).toHaveAttribute('href', path)

      for (const { path: target } of noindexTwins)
        expect(
          (await page.request.get(target)).status(),
          `${target} is served`
        ).toBe(200)
    })
  }

  test('an English-only page offers no language links', async ({ page }) => {
    const footer = page.getByRole('contentinfo')

    await page.goto('/comfy-agent/')

    await expect(
      footer.getByRole('navigation', { name: 'Products' })
    ).toHaveCount(1)
    await expect(
      footer.getByRole('navigation', { name: 'Language' })
    ).toHaveCount(0)
    await expect(footer.getByRole('link', { name: '简体中文' })).toHaveCount(0)
  })
})
