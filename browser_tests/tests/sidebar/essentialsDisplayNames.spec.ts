import { expect } from '@playwright/test'

import { comfyPageFixture as test } from '../../fixtures/ComfyPage'

test.describe('Essentials display names', () => {
  test('backend serves essentials_category on nodes via object_info', async ({
    comfyPage
  }) => {
    const objectInfo = await comfyPage.page.evaluate(async () => {
      const response = await fetch('/object_info')
      return response.json()
    })

    const nodesWithEssentials = Object.entries(objectInfo).filter(
      ([, def]: [string, Record<string, unknown>]) =>
        typeof def.essentials_category === 'string'
    )

    expect(nodesWithEssentials.length).toBeGreaterThan(0)
  })

  test('mapped nodes exist in object_info', async ({ comfyPage }) => {
    const objectInfo = await comfyPage.page.evaluate(async () => {
      const response = await fetch('/object_info')
      return response.json()
    })

    const expectedNodes = [
      'LoadImage',
      'SaveImage',
      'ImageCrop',
      'ImageScale',
      'ImageRotate',
      'ImageInvert',
      'Canny',
      'ImageCompare',
      'LoraLoader',
      'LoadAudio',
      'SaveAudio'
    ]

    for (const nodeName of expectedNodes) {
      expect(
        objectInfo[nodeName],
        `Expected node "${nodeName}" to exist in object_info`
      ).toBeDefined()
    }
  })

  test('mapped node display names render in the node library sidebar', async ({
    comfyPage
  }) => {
    await comfyPage.settings.setSetting('Comfy.UseNewMenu', 'Top')
    const tab = comfyPage.menu.nodeLibraryTab
    await tab.open()

    await tab.nodeLibrarySearchBoxInput.fill('LoadImage')
    await expect(tab.getNode('Load Image')).toBeVisible()
  })
})
