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
})
