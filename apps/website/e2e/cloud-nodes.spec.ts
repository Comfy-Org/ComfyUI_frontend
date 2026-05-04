import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Cloud nodes page @smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cloud/supported-nodes')
  })

  test('has correct title', async ({ page }) => {
    await expect(page).toHaveTitle('Custom nodes on Comfy Cloud — Comfy')
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
})

test.describe('Cloud nodes page (zh-CN) @smoke', () => {
  test('renders localized title and packs', async ({ page }) => {
    await page.goto('/zh-CN/cloud/supported-nodes')
    await expect(page).toHaveTitle('Comfy Cloud 上的自定义节点 — Comfy')
    await expect(page.getByTestId('cloud-node-pack-card').first()).toBeVisible()
    await expect(
      page.getByTestId('cloud-node-pack-banner').first()
    ).toBeVisible()
  })
})
