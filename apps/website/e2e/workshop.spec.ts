import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

const MODEL_PATH = '/workshop/models/openai-dall-e/'

async function useAccount(page: Page, kind: 'new' | 'existing') {
  await page.getByTestId('prototype-tweaks').click()
  await page.getByTestId('tweak-session').selectOption(kind)
  await page.keyboard.press('Escape')
}

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

  test('homepage model releases open their Workshop model', async ({
    page
  }) => {
    await page.goto('/')
    const explore = page.getByRole('link', { name: /Explore Seedance/i })
    await expect(explore).toHaveAttribute(
      'href',
      /\/workshop\/models\/seedance-2\//
    )
  })
})

test.describe('Model playground', () => {
  test('sends signed-out visitors to the Cloud login', async ({ page }) => {
    await page.goto(MODEL_PATH)
    const run = page.getByTestId('run-button')
    await expect(run).toHaveAttribute('data-gate', 'signedOut')
    await expect(run).toHaveAttribute(
      'href',
      'https://cloud.comfy.org/cloud/login'
    )
    await expect(
      page.getByTestId('desktop-nav-cta').getByTestId('header-sign-in')
    ).toHaveAttribute('href', 'https://cloud.comfy.org/cloud/login')
  })

  test('validates the prompt, runs, cancels and completes', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    await useAccount(page, 'existing')

    const run = page.getByTestId('run-button')
    await expect(run).toHaveAttribute('data-gate', 'ready')
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
    ).toContainText('5,832')
  })

  test('a new account starts with welcome credits', async ({ page }) => {
    await page.goto(MODEL_PATH)
    await useAccount(page, 'new')
    await expect(
      page.getByTestId('desktop-nav-cta').getByTestId('header-credits')
    ).toContainText('35')
    await page
      .getByTestId('desktop-nav-cta')
      .getByTestId('header-account')
      .click()
    await expect(page.getByTestId('account-upgrade')).toBeVisible()
  })

  test('tops up credits in place when the balance is too low', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    await useAccount(page, 'existing')
    await page.getByTestId('prototype-tweaks').click()
    await page.getByTestId('tweak-zero-balance').click()
    await page.keyboard.press('Escape')

    const run = page.getByTestId('run-button')
    await expect(run).toHaveAttribute('data-gate', 'noCredits')
    await run.click()
    const dialog = page.getByTestId('top-up-dialog')
    await expect(dialog.getByTestId('top-up-insufficient')).toBeVisible()
    await dialog.getByTestId('top-up-preset-25').click()
    await expect(dialog.getByTestId('top-up-credits')).toHaveValue('5275')
    await dialog.getByTestId('top-up-continue').click()
    await dialog.getByTestId('top-up-pay').click()
    await expect(dialog.getByTestId('top-up-done')).toBeVisible({
      timeout: 10_000
    })
    await page.getByRole('button', { name: 'Done' }).click()
    await expect(run).toHaveAttribute('data-gate', 'ready')
    await expect(
      page.getByTestId('desktop-nav-cta').getByTestId('header-credits')
    ).toContainText('5,275')
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
