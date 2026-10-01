import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Supported model explorer @smoke', () => {
  test('finds a refreshed partner model and opens its detail page', async ({
    page
  }) => {
    await page.goto('/p/supported-models/')
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Every model. One graph.'
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
      'Fish Audio in ComfyUI'
    )
  })

  test('opens the complete catalog and shows an empty state for an unknown model', async ({
    page
  }) => {
    await page.goto('/p/supported-models/?catalog=all&access=open')
    await expect(
      page.getByRole('radio', { name: 'Open Weights', exact: true })
    ).toBeChecked()
    await expect(page.getByRole('status')).toHaveText(/\d+ matching models/)

    await page
      .getByRole('searchbox', { name: 'Search supported models' })
      .fill('no-such-model-987654321')
    await expect(page.getByRole('status')).toHaveText('0 matching models')
    await expect(
      page.getByText('No supported models match this search yet.')
    ).toBeVisible()
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
