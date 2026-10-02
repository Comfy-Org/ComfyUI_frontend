import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Supported model explorer @smoke', () => {
  test('opens a specific model from the trending collection', async ({
    page
  }) => {
    await page.goto('/p/supported-models/')
    const trending = page.getByRole('region', { name: 'TRENDING', exact: true })
    await expect(trending.getByRole('heading', { level: 3 })).toHaveCount(8)
    await expect(trending).toContainText('What is running this week.')
    await expect(trending).toContainText(
      'Create detailed images with text and multiple visual references.'
    )
    await expect(
      trending.getByRole('link', { name: 'Seedance (ByteDance)', exact: true })
    ).toHaveCount(0)
    await trending
      .getByRole('link', { name: 'Seedream 5.0 Pro', exact: true })
      .click()
    await expect(page).toHaveURL(
      /\/hub\/models\/seedream-5-0-pro-text-to-image\/?$/
    )
    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Seedream 5.0 Pro'
    )
  })

  test('opens the full directory with the selected filter and returns through the breadcrumb', async ({
    page
  }) => {
    await page.goto('/p/supported-models/')
    await page.getByRole('radio', { name: 'Video', exact: true }).click()
    await page
      .getByRole('region', { name: 'TRENDING', exact: true })
      .getByRole('link', { name: 'VIEW ALL MODELS', exact: true })
      .click()
    await expect(page).toHaveURL(
      /\/p\/supported-models\/all\/\?category=video$/
    )
    await expect(
      page.getByRole('radio', { name: 'Video', exact: true })
    ).toBeChecked()
    await expect(
      page.locator('#model-catalog-results').getByRole('heading', { level: 3 })
    ).toHaveCount(24)
    await page.getByRole('button', { name: 'Load more', exact: true }).click()
    await expect(
      page.locator('#model-catalog-results').getByRole('heading', { level: 3 })
    ).toHaveCount(48)
    await page
      .getByRole('navigation', { name: 'Breadcrumb', exact: true })
      .getByRole('link')
      .click()
    await expect(
      page.getByRole('region', { name: 'TRENDING', exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('region', { name: 'LATEST', exact: true })
    ).toBeVisible()
    await expect(page.locator('#model-catalog-results')).toHaveCount(0)
  })

  test('filters featured collections without revealing the catalog', async ({
    page
  }) => {
    await page.goto('/p/supported-models/')
    await page.getByRole('radio', { name: 'Image', exact: true }).click()
    await expect(
      page.getByRole('region', { name: 'ALL MODELS', exact: true })
    ).toHaveCount(0)
    await expect(
      page
        .getByRole('region', { name: 'TRENDING', exact: true })
        .getByRole('heading', { level: 3 })
    ).toHaveCount(8)
    await expect(
      page
        .getByRole('region', { name: 'LATEST', exact: true })
        .getByRole('heading', { level: 3 })
    ).toHaveCount(4)
  })

  test('shows verified releases with quantization variants grouped', async ({
    page
  }) => {
    await page.goto('/p/supported-models/')
    const latest = page.getByRole('region', {
      name: 'LATEST',
      exact: true
    })
    await expect(
      latest.getByRole('link', { name: 'Qwen Image 2.1', exact: true }).first()
    ).toBeVisible()
    await expect(latest).toContainText(
      'Generate and edit images with typography and transparent backgrounds.'
    )
    await expect(
      latest.getByText('OPEN WEIGHTS', { exact: true }).first()
    ).toBeVisible()
    await expect(latest).not.toContainText('Release announcements')
    await latest
      .getByRole('link', { name: 'Qwen Image 2.1', exact: true })
      .first()
      .click()
    await expect(page).toHaveURL(
      /\/p\/supported-models\/qwen-image-2-1-int8-convrot\/?$/
    )
  })

  test('finds a refreshed partner model and opens its detail page', async ({
    page
  }) => {
    await page.goto('/p/supported-models/all/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'All supported models'
    )

    await page
      .getByRole('radio', { name: 'Partner Nodes', exact: true })
      .click()
    await page
      .getByRole('searchbox', { name: 'Search supported models' })
      .fill('fish audio')
    await expect(page.getByRole('status')).toHaveText('1 matching models')
    await page.getByRole('link', { name: 'Fish Audio', exact: true }).click()

    await expect(page).toHaveURL(/\/p\/supported-models\/fish-audio\/?$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Fish Audio'
    )
  })

  test('opens the complete catalog and shows an empty state for an unknown model', async ({
    page
  }) => {
    await page.goto('/p/supported-models/all/?access=open')
    await expect(
      page.getByRole('radio', { name: 'Open Weights', exact: true })
    ).toBeChecked()
    await expect(page.getByRole('status')).toHaveText(/\d+ matching models/)

    await page
      .getByRole('searchbox', { name: 'Search supported models' })
      .fill('no-such-model-987654321')
    await expect(page.getByRole('status')).toHaveText('0 matching models')
    await expect(
      page.getByText('No supported models match this search yet.', {
        exact: true
      })
    ).toHaveCount(1)
  })
})

test.describe('Supported model FAQ @smoke', () => {
  test('opens a model question @mobile', async ({ page }) => {
    await page.goto('/p/supported-models/')
    const question = page.getByRole('button', {
      name: 'What does day-zero support mean?',
      exact: true
    })
    await question.scrollIntoViewIfNeeded()
    await expect(
      page.locator('astro-island[component-url*="FAQSection"]')
    ).not.toHaveAttribute('ssr', '')
    await question.click()
    await expect(question).toHaveAttribute('aria-expanded', 'true')
    await expect(
      page.getByText(
        'It means a newly released model can be used in ComfyUI as soon as its supported integration is available.'
      )
    ).toBeVisible()
  })

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
          const value = JSON.parse(script.innerHTML) as {
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
