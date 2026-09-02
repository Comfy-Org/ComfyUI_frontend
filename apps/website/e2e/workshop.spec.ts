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
  test('lists partner models by use case and filters by search', async ({
    page
  }) => {
    await page.goto('/workshop/')
    const grid = page.getByTestId('workshop-models-grid')
    const cards = grid.getByTestId('workshop-model-card')
    await expect(cards.first()).toBeVisible()
    await expect(page.getByTestId('workshop-tabs')).toHaveCount(0)

    await page.getByTestId('use-case-animate-images').click()
    await expect(cards).toHaveCount(9)
    await expect(cards.first()).toContainText('Video')
    await page.getByTestId('use-case-all').click()

    await page.getByTestId('workshop-search').fill('kling')
    await expect(cards.first()).toContainText('Kling')

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
    await expect(
      page.getByTestId('related-models').getByTestId('workshop-model-card')
    ).toHaveCount(4)
  })

  test('the filter menu drills into a facet and narrows the grid', async ({
    page
  }) => {
    await page.goto('/workshop/')
    const cards = page
      .getByTestId('workshop-models-grid')
      .getByTestId('workshop-model-card')
    await page.getByTestId('workshop-filter').click()
    await page.getByTestId('workshop-filter-capability').click()
    await page.getByTestId('filter-capability-Upscale').click()
    await expect(cards).toHaveCount(3)
    await page.getByTestId('workshop-filter-back').click()
    await expect(
      page.getByTestId('workshop-filter-capability-count')
    ).toHaveText('1')
    await page.getByTestId('workshop-filter-clear').click()
    await expect(cards).toHaveCount(48)
  })

  test('model tags deep-link into a filtered catalog', async ({ page }) => {
    await page.goto('/workshop/models/topaz-labs/')
    const tag = page
      .getByTestId('model-tags')
      .getByRole('link', { name: 'Upscale' })
    await expect(tag).toHaveAttribute('href', '/workshop?capability=Upscale')
    await tag.click()
    await expect(page).toHaveURL(/\/workshop\/?\?capability=Upscale$/)
    await expect(page.getByTestId('workshop-filter-count')).toHaveText('1')
    await expect(
      page
        .getByTestId('workshop-models-grid')
        .getByTestId('workshop-model-card')
    ).toHaveCount(3)
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
  test('signs in through the Cloud-style login and returns to the playground', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    const run = page.getByTestId('run-button')
    await expect(run).toHaveAttribute('data-gate', 'signedOut')
    await expect(run).toHaveAttribute('href', /\/workshop\/sign-in\?return=/)
    await expect(
      page.getByTestId('desktop-nav-cta').getByTestId('header-sign-in')
    ).toHaveAttribute('href', /\/workshop\/sign-in\?return=/)

    const prompt = 'a capybara in a trench coat'
    await page.getByTestId('field-prompt').fill(prompt)
    await run.click()
    await expect(page).toHaveURL(/\/workshop\/sign-in/)
    await expect(page.getByTestId('workshop-sign-in')).toHaveAttribute(
      'data-return',
      MODEL_PATH
    )
    await page.getByTestId('sign-in-github').click()

    await expect(page).toHaveURL(new RegExp(`${MODEL_PATH}$`))
    await expect(page.getByTestId('run-button')).toHaveAttribute(
      'data-gate',
      'ready',
      { timeout: 15_000 }
    )
    await expect(page.getByTestId('field-prompt')).toHaveValue(prompt)
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

  test('a new account starts without credits and is sent to upgrade', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    await useAccount(page, 'new')
    await expect(
      page.getByTestId('desktop-nav-cta').getByTestId('header-credits')
    ).toContainText('No credits')
    await expect(page.getByTestId('run-button')).toHaveAttribute(
      'data-gate',
      'noCredits'
    )
    await page
      .getByTestId('desktop-nav-cta')
      .getByTestId('header-account')
      .click()
    await expect(page.getByTestId('account-upgrade')).toBeVisible()
  })

  test('an empty balance sends the run to Comfy Platform', async ({ page }) => {
    await page.goto(MODEL_PATH)
    await useAccount(page, 'existing')
    await page.getByTestId('prototype-tweaks').click()
    await page.getByTestId('tweak-zero-balance').click()
    await page.keyboard.press('Escape')

    const run = page.getByTestId('run-button')
    await expect(run).toHaveAttribute('data-gate', 'noCredits')
    await expect(run).toHaveAttribute('href', /platform/)
    await expect(
      page.getByTestId('desktop-nav-cta').getByTestId('header-credits')
    ).toHaveAttribute('href', /platform/)
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
