import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

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

  test('a noindex page keeps its language links', async ({ page }) => {
    await page.goto('/privacy-policy/')
    const languages = page
      .getByRole('contentinfo')
      .getByRole('navigation', { name: 'Language' })

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
    await expect(current).toHaveText('English')
    await expect(current).toHaveAttribute('href', '/privacy-policy/')

    await expect
      .poll(() =>
        languages
          .getByRole('link')
          .evaluateAll((links) =>
            links.map((link) => getComputedStyle(link).textDecorationLine)
          )
      )
      .toEqual(['underline', 'none'])

    expect((await page.request.get('/zh-CN/privacy-policy/')).status()).toBe(
      200
    )
  })
})
