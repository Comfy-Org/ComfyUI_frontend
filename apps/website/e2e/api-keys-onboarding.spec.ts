import { expect } from '@playwright/test'

import { waitForIsland } from './fixtures/islands'
import { MODEL_PATH, test } from './fixtures/modelsAccount'

const API_KEYS = 'https://platform.comfy.org/profile/api-keys'
const MODEL_SLUG = MODEL_PATH.split('/')[2]

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

  test('model page API tab names the model in the models onboarding link @models', async ({
    page
  }) => {
    await page.goto(MODEL_PATH)
    const apiTab = page.getByTestId('tab-api')
    await waitForIsland(page, apiTab)
    await apiTab.click()
    await expect(page.getByTestId('api-get-key')).toHaveAttribute(
      'href',
      `${API_KEYS}?onboarding=models&model=${MODEL_SLUG}`
    )
  })
})
