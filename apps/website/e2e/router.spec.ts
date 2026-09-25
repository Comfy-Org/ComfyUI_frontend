import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

test.describe('Router page @smoke', () => {
  test('shows which providers serve each model', async ({ page }) => {
    await page.goto('/platform/router')

    const coverage = page.locator('section').filter({
      has: page.getByRole('heading', {
        level: 2,
        name: 'Same models. More places to run them.'
      })
    })
    const table = coverage.getByRole('table')

    for (const provider of [
      'Comfy',
      'fal',
      'Higgsfield',
      'Runware',
      'WaveSpeed'
    ]) {
      await expect(
        table.getByRole('columnheader', { name: provider })
      ).toBeVisible()
    }
    await expect(
      table.getByRole('row', { name: /^Kling V3/ }).getByRole('cell')
    ).toHaveText([
      /^Served$/,
      /Not served$/,
      /^Served$/,
      /Not served$/,
      /Not served$/
    ])
    await expect(
      table.getByRole('link', { name: 'Nano Banana Pro' })
    ).toHaveAttribute('href', /\/models\/google\/nano-banana-pro\/code$/)
    await expect(
      coverage.getByRole('link', { name: /^Browse all \d+ models$/ })
    ).toHaveAttribute('href', '/models')
  })

  test('adds the chosen provider to the code sample', async ({ page }) => {
    await page.goto('/platform/router')

    const providers = page.getByRole('radiogroup', { name: 'Provider' })
    const code = page
      .locator('section')
      .filter({ has: providers })
      .locator('code')

    await expect(code).not.toContainText('model_provider')

    const fal = providers.getByRole('radio', { name: 'fal' })
    await expect(async () => {
      await fal.click()
      await expect(fal).toBeChecked({ timeout: 1_000 })
    }).toPass({ timeout: 10_000 })
    await expect(code).toContainText('model_provider="fal"')

    await providers.getByRole('radio', { name: 'Runware' }).click()
    await expect(code).toContainText('model_provider="runware"')
    await expect(code).not.toContainText('"fal"')
  })
})
