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
