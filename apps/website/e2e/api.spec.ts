import { expect } from '@playwright/test'

import { externalLinks } from '../src/config/routes'
import { t } from '../src/i18n/translations'
import { test } from './fixtures/blockExternalMedia'

test.describe('API page @smoke', () => {
  test('sends the serverless beta cta to the survey in a safe new tab', async ({
    page
  }) => {
    await page.goto('/api')

    const joinBeta = page.getByRole('link', { name: t('api.steps.beta.cta') })

    await expect(joinBeta).toBeVisible()
    await expect(joinBeta).toHaveAttribute('href', externalLinks.serverlessBeta)
    await expect(joinBeta).toHaveAttribute('target', '_blank')
    await expect(joinBeta).toHaveAttribute('rel', 'noopener noreferrer')
  })
})

test.describe('API page (zh-CN) @smoke', () => {
  test('localizes the serverless beta cta', async ({ page }) => {
    await page.goto('/zh-CN/api')

    const joinBeta = page.getByRole('link', {
      name: t('api.steps.beta.cta', 'zh-CN')
    })

    await expect(joinBeta).toBeVisible()
    await expect(joinBeta).toHaveAttribute('href', externalLinks.serverlessBeta)
    await expect(
      page.getByRole('link', { name: t('api.steps.beta.cta') })
    ).toHaveCount(0)
  })
})
