import { expect } from '@playwright/test'

import { comfyPageFixture } from './fixtures/ComfyPage'

const test = comfyPageFixture

test.describe('Selection Toolbox', () => {
  test.beforeEach(async ({ comfyPage }) => {
    await comfyPage.setSetting('Comfy.Canvas.SelectionToolbox', true)
  })

  test('shows selection toolbox', async ({ comfyPage }) => {
    // By default, selection toolbox should be enabled
    expect(
      await comfyPage.page.locator('.selection-overlay-container').isVisible()
    ).toBe(false)

    // Select multiple nodes
    await comfyPage.selectNodes(['KSampler', 'CLIP Text Encode (Prompt)'])

    // Selection toolbox should be visible with multiple nodes selected
    await expect(
      comfyPage.page.locator('.selection-overlay-container')
    ).toBeVisible()
    await expect(
      comfyPage.page.locator('.selection-overlay-container.show-border')
    ).toBeVisible()
  })

  test('shows border only with multiple selections', async ({ comfyPage }) => {
    // Select single node
    await comfyPage.selectNodes(['KSampler'])

    // Selection overlay should be visible but without border
    await expect(
      comfyPage.page.locator('.selection-overlay-container')
    ).toBeVisible()
    await expect(
      comfyPage.page.locator('.selection-overlay-container.show-border')
    ).not.toBeVisible()

    // Select multiple nodes
    await comfyPage.selectNodes(['KSampler', 'CLIP Text Encode (Prompt)'])

    // Selection overlay should show border with multiple selections
    await expect(
      comfyPage.page.locator('.selection-overlay-container.show-border')
    ).toBeVisible()

    // Deselect to single node
    await comfyPage.selectNodes(['CLIP Text Encode (Prompt)'])

    // Border should be hidden again
    await expect(
      comfyPage.page.locator('.selection-overlay-container.show-border')
    ).not.toBeVisible()
  })

  test('displays refresh button in toolbox when all nodes are selected', async ({
    comfyPage
  }) => {
    // Select all nodes
    await comfyPage.page.focus('canvas')
    await comfyPage.page.keyboard.press('Control+A')

    await expect(
      comfyPage.page.locator('.selection-toolbox .pi-refresh')
    ).toBeVisible()
  })

  test('displays bypass button in toolbox when nodes are selected', async ({
    comfyPage
  }) => {
    // A group + a KSampler node
    await comfyPage.loadWorkflow('single_group')

    // Select group + node should show bypass button
    await comfyPage.page.focus('canvas')
    await comfyPage.page.keyboard.press('Control+A')
    await expect(
      comfyPage.page.locator(
        '.selection-toolbox *[data-testid="bypass-button"]'
      )
    ).toBeVisible()

    // Deselect node (Only group is selected) should hide bypass button
    await comfyPage.selectNodes(['KSampler'])
    await expect(
      comfyPage.page.locator(
        '.selection-toolbox *[data-testid="bypass-button"]'
      )
    ).not.toBeVisible()
  })
})
