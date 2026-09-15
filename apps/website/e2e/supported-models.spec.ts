import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Supported model catalog @smoke', () => {
  test('filters models and supports search shortcuts', async ({ page }) => {
    await page.goto('/p/supported-models/')

    const search = page.getByRole('searchbox', { name: 'Search models' })
    const cards = page.locator('#model-grid > li[data-search]')
    const emptyState = page.getByRole('status')

    await expect(cards.first()).toBeVisible()
    await expect(search).toHaveAttribute('aria-keyshortcuts', '/')

    await page.keyboard.press('/')
    await expect(search).toBeFocused()

    await search.fill('grok imagine')
    await expect(page.getByRole('link', { name: 'Grok Imagine' })).toBeVisible()

    await search.fill('no-such-model')
    await expect(emptyState).toBeVisible()
    await expect(cards.first()).toBeHidden()

    await page.keyboard.press('Escape')
    await expect(search).toHaveValue('')
    await expect(search).not.toBeFocused()
    await expect(emptyState).toBeHidden()
    await expect(cards.first()).toBeVisible()
  })
})

test.describe('Supported model FAQ @smoke', () => {
  test('renders the same questions as the FAQPage schema', async ({ page }) => {
    await page.goto('/p/supported-models/grok-imagine/')

    const faqHeading = page.getByRole('heading', {
      name: 'Frequently Asked Questions'
    })
    await expect(faqHeading).toBeVisible()

    const visibleQuestions = await faqHeading
      .locator('xpath=../following-sibling::*')
      .getByRole('button')
      .allTextContents()
    const faqPage = await page
      .locator('script[type="application/ld+json"]')
      .evaluateAll((scripts) => {
        const nodes = scripts.flatMap((script) => {
          const value = JSON.parse(script.textContent) as {
            '@graph'?: Array<Record<string, unknown>>
          }
          return value['@graph'] ?? []
        })
        return nodes.find((node) => node['@type'] === 'FAQPage') as {
          mainEntity: Array<{ name: string }>
        }
      })

    expect(visibleQuestions.map((question) => question.trim())).toEqual(
      faqPage.mainEntity.map((question) => question.name)
    )
  })
})
