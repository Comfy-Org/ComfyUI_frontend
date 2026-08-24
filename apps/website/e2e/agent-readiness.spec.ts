import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Agent readiness — markdown twins @smoke', () => {
  for (const path of ['/index.md', '/api.md', '/404.md']) {
    test(`${path} is served with markdown content`, async ({ page }) => {
      const response = await page.request.get(path)
      expect(response.status()).toBe(200)
      const body = await response.text()
      expect(body.startsWith('# ')).toBe(true)
      expect(body).toContain('https://comfy.org/')
    })
  }

  test('the 404 twin maps agents back to the machine surfaces', async ({
    page
  }) => {
    const body = await (await page.request.get('/404.md')).text()
    expect(body).toContain('https://comfy.org/llms.txt')
    expect(body).toContain('https://comfy.org/sitemap-index.xml')
    expect(body).toContain('https://comfy.org/index.md')
  })
})

test.describe('Agent readiness — 404 recovery @smoke', () => {
  test('unknown paths return 404 with recovery links', async ({ page }) => {
    const response = await page.goto('/this-path-does-not-exist')
    expect(response?.status()).toBe(404)

    const nav = page.getByRole('navigation', {
      name: 'Places to go from here'
    })
    await expect(nav).toBeVisible()
    await expect(nav.getByRole('link', { name: 'llms.txt' })).toHaveAttribute(
      'href',
      '/llms.txt'
    )
    await expect(nav.getByRole('link', { name: 'Site map' })).toHaveAttribute(
      'href',
      '/sitemap-index.xml'
    )
    await expect(
      nav.getByRole('link', { name: 'OpenAPI spec' })
    ).toHaveAttribute('href', '/openapi.json')
  })
})

test.describe('Agent readiness — homepage outline @smoke', () => {
  test('renders one h1 and a full h2 section outline without JS state', async ({
    page
  }) => {
    await page.goto('/')

    await expect(page.locator('h1')).toHaveCount(1)

    for (const name of [
      'Latest model releases',
      'How ComfyUI works',
      'Industries that create with ComfyUI',
      'Get started in minutes'
    ]) {
      await expect(page.getByRole('heading', { name, level: 2 })).toBeAttached()
    }

    // Model slide titles nest under the section heading as h3s.
    await expect(
      page.getByRole('heading', { name: 'Seedance 2.5', level: 3 })
    ).toBeAttached()
  })
})
