import type { BrowserContext } from '@playwright/test'
import { expect } from '@playwright/test'

import { test } from './fixtures/blockExternalMedia'

async function mockWorkflowVisibility(
  context: BrowserContext,
  enabled: boolean
) {
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
}

for (const enabled of [true, false]) {
  test(`workflow catalog and direct page respect workflow enablement: ${enabled}`, async ({
    page,
    context
  }) => {
    await mockWorkflowVisibility(context, enabled)
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

test('the background example pairs its input and output and restores edited inputs', async ({
  page,
  context
}) => {
  await mockWorkflowVisibility(context, true)
  await page.goto('/models/workflows/remove-background/')
  const input = page.getByRole('group', { name: 'Your image', exact: true })
  const original = input.getByRole('img', { name: 'the_lily_veil.png' })
  const example = page.getByRole('button', { name: /Template example/ })
  await expect(example).toHaveCount(1)
  await expect(original).toHaveAttribute(
    'src',
    'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/90c71fb78b3726392d010ff62a8e79e92d7296ad/input/the_lily_veil.png'
  )
  await expect(
    page.getByRole('img', { name: 'Output', exact: true })
  ).toHaveAttribute(
    'src',
    'https://raw.githubusercontent.com/Comfy-Org/workflow_templates/90c71fb78b3726392d010ff62a8e79e92d7296ad/templates/utility_birefnet_remove_background-1.webp'
  )
  await input.getByRole('button', { name: 'Remove the_lily_veil.png' }).click()
  await example.click()
  await expect(page.getByTestId('example-replace-dialog')).toBeVisible()
  await page.getByTestId('example-replace-keep').click()
  await expect(original).toHaveCount(0)
  await example.click()
  await page.getByTestId('example-replace-confirm').click()
  await expect(original).toBeVisible()
  await page.reload()
  await expect(original).toBeVisible()
})
