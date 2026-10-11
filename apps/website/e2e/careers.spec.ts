import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Careers page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/careers')
  })

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Careers - Comfy')
  })

  test('hero autoplays the recruiting video muted with player controls', async ({
    page
  }) => {
    const video = page.locator('video')

    await expect(video).toHaveAttribute(
      'src',
      'https://media.comfy.org/website/careers/recruiting-v03.mp4'
    )
    await expect(video).toHaveAttribute('loop', '')
    await expect(video).toHaveJSProperty('muted', true)
    await expect
      .poll(
        async () =>
          video.evaluate((element: HTMLVideoElement) => element.currentTime),
        { timeout: 15_000 }
      )
      .toBeGreaterThan(0)

    await video.hover()
    await expect(page.getByRole('button', { name: 'Unmute' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible()
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

  test('clicking a department button scrolls to and activates that section', async ({
    page
  }) => {
    const rolesSection = page.getByTestId('careers-roles')
    await rolesSection.scrollIntoViewIfNeeded()
    await expect(rolesSection).toBeVisible()

    const allCount = await page.getByTestId('careers-role-link').count()

    const engineeringButton = page.getByRole('button', {
      name: 'ENGINEERING',
      exact: true
    })

    // RolesSection is hydrated via `client:visible`. Once the button responds
    // to a click by flipping aria-pressed, Vue is hydrated and the rest of
    // the locator logic is in effect.
    await expect(async () => {
      await engineeringButton.click()
      await expect(engineeringButton).toHaveAttribute('aria-pressed', 'true', {
        timeout: 1_000
      })
    }).toPass({ timeout: 10_000 })

    const engineeringSection = page.locator('#careers-dept-engineering')
    await expect(engineeringSection).toBeInViewport()

    expect(await page.getByTestId('careers-role-link').count()).toBe(allCount)
  })
})

test.describe('Careers page role links', () => {
  test('each role links to the Ashby job description page, not the application form', async ({
    page
  }) => {
    await page.goto('/careers')
    const roles = page.getByTestId('careers-role-link')
    const count = await roles.count()
    for (let i = 0; i < count; i++) {
      const href = await roles.nth(i).getAttribute('href')
      expect(href).toMatch(/^https:\/\/jobs\.ashbyhq\.com\//)
      expect(href).not.toMatch(/\/application\/?$/)
    }
  })
})

test.describe('Careers page (zh-CN) @smoke', () => {
  test('renders localized heading and roles', async ({ page }) => {
    await page.goto('/zh-CN/careers')
    await expect(page).toHaveTitle('招聘 - Comfy')
    await expect(
      page.getByRole('heading', { name: '职位', level: 2 })
    ).toBeVisible()
    await expect(page.getByTestId('careers-role-link').first()).toBeVisible()
  })
})
