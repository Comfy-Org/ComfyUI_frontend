import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

for (const enabled of [true, false]) {
  test(`workflow catalog and direct page respect workflow enablement: ${enabled}`, async ({
    page,
    context
  }) => {
    await context.route('**/t.comfy.org/**', (route) =>
      /\/(flags|decide)\//.test(route.request().url())
        ? route.fulfill({
            contentType: 'application/json',
            json: {
              featureFlags: {
                'workshop-enabled': true,
                'workshop-workflows-enabled': enabled
              },
              featureFlagPayloads: {}
            }
          })
        : route.abort('blockedbyclient')
    )
    await page.goto('/models/')
    await page.getByTestId('workshop-search').fill('Change a material')
    const card = page.getByRole('link', { name: /Change a material/ })
    await expect(card).toHaveCount(enabled ? 1 : 0)
    await page.goto('/models/workflows/change-material/')
    if (!enabled) {
      await expect(
        page.getByRole('heading', { level: 1, name: /Grok Imagine/ })
      ).toBeVisible()
      await expect(page.getByTestId('workflow-hero')).toHaveCount(0)
      return
    }
    await expect(
      page.getByRole('heading', { name: 'Change a material', exact: true })
    ).toBeVisible()
    await expect(
      page.getByRole('group', { name: 'Your original image' })
    ).toBeVisible()
    await expect(
      page.getByRole('group', { name: 'Material reference' })
    ).toBeVisible()
    const prompt = page.getByRole('textbox', { name: 'What should change?' })
    await expect(prompt).toHaveValue(
      'Change the furniture leather difference in image 1 to the fur material in image 2.'
    )
    await prompt.fill('Use the material from the second image.')
    await page.getByRole('button', { name: /Template example 2/ }).click()
    await expect(prompt).toHaveValue('Use the material from the second image.')
    await expect(
      page.getByRole('link', { name: 'Try in Cloud' })
    ).toHaveAttribute(
      'href',
      'https://testcloud.comfy.org/?template=image_qwen_image_edit_2511'
    )
  })
}
