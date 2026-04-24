import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Careers page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/careers')
  })

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Careers — Comfy')
  })

  test('Roles section heading is visible', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Roles', level: 2 })
    ).toBeVisible()
  })

  test('renders at least one role from the snapshot', async ({ page }) => {
    const roles = page.getByTestId('careers-role-link')
    await expect(roles.first()).toBeVisible()
    expect(await roles.count()).toBeGreaterThan(0)
  })

  test('each role links to jobs.ashbyhq.com', async ({ page }) => {
    const roles = page.getByTestId('careers-role-link')
    const count = await roles.count()
    for (let i = 0; i < count; i++) {
      const href = await roles.nth(i).getAttribute('href')
      expect(href).toMatch(/^https:\/\/jobs\.ashbyhq\.com\//)
    }
  })

  test('ENGINEERING category filter narrows the role list', async ({
    page
  }) => {
    const allCount = await page.getByTestId('careers-role-link').count()
    await page.getByRole('button', { name: 'ENGINEERING', exact: true }).click()
    const engineeringLocator = page.getByTestId('careers-role-link')
    await expect(engineeringLocator.first()).toBeVisible()
    const engineeringCount = await engineeringLocator.count()
    expect(engineeringCount).toBeLessThanOrEqual(allCount)
    expect(engineeringCount).toBeGreaterThan(0)
  })
})

test.describe('Careers page (zh-CN) @smoke', () => {
  test('renders localized heading and roles', async ({ page }) => {
    await page.goto('/zh-CN/careers')
    await expect(page).toHaveTitle('招聘 — Comfy')
    await expect(
      page.getByRole('heading', { name: '职位', level: 2 })
    ).toBeVisible()
    await expect(page.getByTestId('careers-role-link').first()).toBeVisible()
  })
})
