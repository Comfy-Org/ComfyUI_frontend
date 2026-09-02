import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const MODEL_PATH = '/workshop/models/openai-dall-e/'

test.describe('Workshop catalog', () => {
  test('lists partner models and filters by search and modality', async ({
    page
  }) => {
    await page.goto('/workshop/')
    const grid = page.getByTestId('workshop-models-grid')
    await expect(grid.getByTestId('workshop-model-card').first()).toBeVisible()

    await page.getByTestId('workshop-search').fill('kling')
    const cards = grid.getByTestId('workshop-model-card')
    await expect(cards.first()).toContainText('Kling')
    await expect(page.getByTestId('workshop-count')).toContainText(
      /^\d+ models/
    )

    await page.getByTestId('workshop-search').fill('no such model')
    await expect(page.getByTestId('workshop-empty')).toBeVisible()
    await page.getByRole('button', { name: 'Clear filters' }).click()
    await expect(cards.first()).toBeVisible()
  })

  test('model cards open the model detail page', async ({ page }) => {
    await page.goto('/workshop/')
    await page.getByTestId('workshop-search').fill('kling ai')
    await page.getByTestId('workshop-model-card').first().click()
    await expect(page).toHaveURL(/\/workshop\/models\/kling-ai\/?$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kling AI')
  })
})

test.describe('Model playground', () => {
  test('asks to sign in before running and does not auto-run', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    const run = page.getByTestId('run-button')
    await expect(run).toHaveAttribute('data-gate', 'signedOut')

    await run.click()
    const dialog = page.getByTestId('sign-in-dialog')
    await expect(dialog).toBeVisible()
    await dialog.getByTestId('sign-in-google').click()

    await expect(dialog).toBeHidden()
    await expect(page.getByTestId('signed-in-notice')).toBeVisible()
    await expect(page.getByTestId('playground-output')).toHaveAttribute(
      'data-state',
      'idle'
    )
    await expect(run).toHaveAttribute('data-gate', 'ready')
  })

  test('validates the prompt, runs, cancels and completes', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    await page.getByTestId('run-button').click()
    await page.getByTestId('sign-in-github').click()

    const run = page.getByTestId('run-button')
    await page.getByTestId('field-prompt').fill('')
    await run.click()
    await expect(page.getByTestId('error-prompt')).toBeVisible()

    await page
      .getByTestId('field-prompt')
      .fill('A slow dolly-in on a neon street')
    await run.click()
    const output = page.getByTestId('playground-output')
    await expect(output).toHaveAttribute('data-state', 'running')
    await page.getByTestId('run-cancel').click()
    await expect(output).toHaveAttribute('data-state', 'cancelled')

    await page.getByRole('button', { name: 'Run again' }).click()
    await run.click()
    await expect(output).toHaveAttribute('data-state', 'succeeded', {
      timeout: 10_000
    })
    await expect(page.getByTestId('run-credits-used')).toContainText('8')
    await expect(page.getByTestId('output-download')).toBeVisible()
    await expect(
      page.getByTestId('desktop-nav-cta').getByTestId('header-credits')
    ).toContainText('1,242')
  })

  test('asks to buy credits when the balance is too low', async ({ page }) => {
    await page.goto(MODEL_PATH)
    await page.getByTestId('run-button').click()
    await page.getByTestId('sign-in-google').click()

    await page
      .getByTestId('desktop-nav-cta')
      .getByTestId('header-account')
      .click()
    await page.getByTestId('account-simulate-balance').click()

    const run = page.getByTestId('run-button')
    await expect(run).toHaveAttribute('data-gate', 'noCredits')
    await expect(run).toHaveAttribute('href', /platform\.comfy\.org/)
  })

  test('API tab mirrors the form values', async ({ page }) => {
    await page.goto(MODEL_PATH)
    await page.getByTestId('field-prompt').fill('neon street at night')
    await page.getByTestId('tab-api').click()
    await expect(page.getByTestId('snippet')).toContainText(
      'neon street at night'
    )
    await expect(page.getByTestId('snippet')).toContainText(
      'openai/openai-dall-e'
    )
    await page.getByTestId('snippet-http').click()
    await expect(page.getByTestId('snippet')).toContainText('POST https://')
  })

  test('examples open in the playground with their settings', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    await page.getByTestId('field-prompt').fill('')
    await page.getByTestId('tab-examples').click()
    await page.getByTestId('example-open').first().click()
    await expect(page.getByTestId('playground-tab')).toBeVisible()
    await expect(page.getByTestId('field-prompt')).not.toHaveValue('')
  })
})
