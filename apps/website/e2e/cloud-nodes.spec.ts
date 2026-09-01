import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Cloud nodes page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cloud/supported-nodes')
  })

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle(
      'Custom-node packs on Comfy Cloud — supported by default'
    )
  })

  test('renders at least one pack card', async ({ page }) => {
    const cards = page.getByTestId('cloud-node-pack-card')
    await expect(cards.first()).toBeVisible()
    expect(await cards.count()).toBeGreaterThan(0)
  })

  test('search input filters cards down', async ({ page }) => {
    const cards = page.getByTestId('cloud-node-pack-card')
    const initialCount = await cards.count()

    await page.getByTestId('cloud-nodes-search').fill('impact')
    const filteredCards = page.getByTestId('cloud-node-pack-card')
    await expect(filteredCards.first()).toBeVisible()
    const filteredCount = await filteredCards.count()

    expect(filteredCount).toBeGreaterThan(0)
    expect(filteredCount).toBeLessThanOrEqual(initialCount)
  })

  test('renders banner image or fallback element', async ({ page }) => {
    const banners = page.getByTestId('cloud-node-pack-banner')
    await expect(banners.first()).toBeVisible()
  })

  test('opens pack detail page from first card', async ({ page }) => {
    const firstCard = page.getByTestId('cloud-node-pack-card').first()
    await expect(firstCard).toBeVisible()

    await firstCard.locator('a').first().click()

    await expect(page).toHaveURL(/\/cloud\/supported-nodes\/[a-z0-9-]+$/)
    await expect(page.getByTestId('cloud-node-pack-detail')).toBeVisible()
  })

  test('direct pack detail route renders node entries', async ({ page }) => {
    await page.goto('/cloud/supported-nodes/comfyui-impact-pack')
    await expect(page.getByTestId('cloud-node-pack-detail')).toBeVisible()
    await expect(
      page.getByTestId('cloud-node-pack-detail-node').first()
    ).toBeVisible()
  })

  test('search with no matches shows empty state', async ({ page }) => {
    await page
      .getByTestId('cloud-nodes-search')
      .fill('zzzz-this-pack-does-not-exist')
    await expect(page.getByTestId('cloud-node-pack-card')).toHaveCount(0)
    await expect(page.getByText('No matching packs')).toBeVisible()
  })

  test('clearing search restores the full list', async ({ page }) => {
    const cards = page.getByTestId('cloud-node-pack-card')
    const initialCount = await cards.count()

    await page.getByTestId('cloud-nodes-search').fill('impact')
    await expect(cards.first()).toBeVisible()

    await page.getByTestId('cloud-nodes-search').fill('')
    await expect(cards).toHaveCount(initialCount)
  })

  test('search matches against node display names, not just pack names', async ({
    page
  }) => {
    await page.getByTestId('cloud-nodes-search').fill('FaceDetailer')
    await expect(page.getByTestId('cloud-node-pack-card')).toHaveCount(1)
    await expect(
      page.getByTestId('cloud-node-pack-card-link').first()
    ).toContainText('Impact Pack')
  })

  test('switching sort to A → Z reorders cards alphabetically', async ({
    page
  }) => {
    await page.locator('#cloud-nodes-sort').selectOption('az')
    const firstName = await page
      .getByTestId('cloud-node-pack-card-link')
      .first()
      .textContent()
    expect(firstName?.trim().toLowerCase().charAt(0)).toMatch(/^[a-c]/)
  })

  test('list grid carries a localized aria-label', async ({ page }) => {
    await expect(
      page.getByRole('list', {
        name: 'Custom-node packs supported on Comfy Cloud'
      })
    ).toBeVisible()
  })

  test('clicking the back link returns to the index from a detail page', async ({
    page
  }) => {
    await page.goto('/cloud/supported-nodes/comfyui-impact-pack')
    await page.getByRole('link', { name: 'Back to all packs' }).click()
    await expect(page).toHaveURL(/\/cloud\/supported-nodes\/?$/)
    await expect(page.getByTestId('cloud-node-pack-card').first()).toBeVisible()
  })

  test('detail page renders publisher and external repo link', async ({
    page
  }) => {
    await page.goto('/cloud/supported-nodes/comfyui-impact-pack')
    const repoLink = page.getByRole('link', {
      name: /github\.com\/ltdrdata\/ComfyUI-Impact-Pack/
    })
    await expect(repoLink).toBeVisible()
    await expect(repoLink).toHaveAttribute('rel', /noopener/)
  })

  test('unknown pack slug 404s', async ({ page }) => {
    const response = await page.goto(
      '/cloud/supported-nodes/this-pack-does-not-exist'
    )
    expect(response?.status()).toBe(404)
  })

  test('JSON-LD ItemList is emitted on the index page', async ({ page }) => {
    const jsonLd = page.locator('script[type="application/ld+json"]')
    const ldBlocks = await jsonLd.allTextContents()
    expect(ldBlocks.some((b) => b.includes('"@type":"ItemList"'))).toBeTruthy()
  })

  test('JSON-LD payload escapes <-sequences', async ({ page }) => {
    const ldBlocks = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents()
    for (const block of ldBlocks) {
      expect(block).not.toContain('</script')
    }
  })
})

test.describe('Cloud nodes page (zh-CN) @smoke', () => {
  test('renders localized title and packs', async ({ page }) => {
    await page.goto('/zh-CN/cloud/supported-nodes')
    await expect(page).toHaveTitle('Comfy Cloud 自定义节点包合集——开箱即用')
    await expect(page.getByTestId('cloud-node-pack-card').first()).toBeVisible()
    await expect(
      page.getByTestId('cloud-node-pack-banner').first()
    ).toBeVisible()
  })

  test('opens pack detail page from first card', async ({ page }) => {
    await page.goto('/zh-CN/cloud/supported-nodes')
    const firstCard = page.getByTestId('cloud-node-pack-card').first()
    await expect(firstCard).toBeVisible()

    await firstCard.locator('a').first().click()

    await expect(page).toHaveURL(/\/zh-CN\/cloud\/supported-nodes\/[a-z0-9-]+$/)
    await expect(page.getByTestId('cloud-node-pack-detail')).toBeVisible()
  })
})
