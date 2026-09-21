import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'
import { waitForIsland } from './fixtures/islands'

const API_KEYS = 'https://platform.comfy.org/profile/api-keys'
const MODEL_SLUG = 'byteplus--seedream-5-pro--generate-images'

test.describe('API-keys onboarding links @smoke', () => {
  for (const { path, label } of [
    { path: '/platform/router', label: 'Get your API key' },
    { path: '/zh-CN/platform/router', label: '获取 API 密钥' }
  ]) {
    test(`Router hero sends a Router onboarding arrival: ${path}`, async ({
      page
    }) => {
      await page.goto(path)
      await expect(page.getByRole('link', { name: label })).toHaveAttribute(
        'href',
        `${API_KEYS}?onboarding=router`
      )
    })
  }

  test('model page API tab names the model in the Router onboarding link', async ({
    page
  }) => {
    await page.goto(`/models/${MODEL_SLUG}/`)
    const apiTab = page.getByTestId('tab-api')
    await waitForIsland(page, apiTab)
    await apiTab.click()
    await expect(page.getByTestId('api-get-key')).toHaveAttribute(
      'href',
      `${API_KEYS}?onboarding=router&model=${MODEL_SLUG}`
    )
  })
})
