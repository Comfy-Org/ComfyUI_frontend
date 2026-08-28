import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '@e2e/fixtures/ComfyPage'

test.describe('Image Crop', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow('widgets/image_crop_widget')
    await comfyPage.vueNodes.waitForNodes()
  })

  test(
    'Shows empty state when no input image is connected',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      await expect(node).toBeVisible()

      await expect(node.getByText('No input image connected')).toBeVisible()
      await expect(node.locator('img[alt="Crop preview"]')).toHaveCount(0)
    }
  )

  test(
    'Renders bounding box coordinate inputs',
    { tag: '@smoke' },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      await expect(node).toBeVisible()

      await expect(node.getByText('X')).toBeVisible()
      await expect(node.getByText('Y')).toBeVisible()
      await expect(node.getByText('Width')).toBeVisible()
      await expect(node.getByText('Height')).toBeVisible()
    }
  )

  test(
    'Renders ratio selector and lock button',
    { tag: '@ui' },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')
      await expect(node).toBeVisible()

      await expect(node.getByText('Ratio')).toBeVisible()
      await expect(node.getByRole('button', { name: /lock/i })).toBeVisible()
    }
  )

  test(
    'Lock button toggles aspect ratio lock',
    { tag: '@ui' },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')

      const lockButton = node.getByRole('button', {
        name: 'Lock aspect ratio'
      })
      await expect(lockButton).toBeVisible()

      await lockButton.click()
      await expect(
        node.getByRole('button', { name: 'Unlock aspect ratio' })
      ).toBeVisible()

      await node.getByRole('button', { name: 'Unlock aspect ratio' }).click()
      await expect(
        node.getByRole('button', { name: 'Lock aspect ratio' })
      ).toBeVisible()
    }
  )

  test(
    'Ratio selector offers expected presets',
    { tag: '@ui' },
    async ({ comfyPage }) => {
      const node = comfyPage.vueNodes.getNodeLocator('1')

      const trigger = node.getByRole('combobox')
      await trigger.click()

      const expectedRatios = ['1:1', '3:4', '4:3', '16:9', '9:16', 'Custom']
      for (const label of expectedRatios) {
        await expect(
          comfyPage.page.getByRole('option', { name: label, exact: true })
        ).toBeVisible()
      }
    }
  )
})
