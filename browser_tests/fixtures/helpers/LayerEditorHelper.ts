import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { comfyPageFixture } from '@e2e/fixtures/ComfyPage'
import { assetPath } from '@e2e/fixtures/utils/paths'
import { mockViewFiles } from '@e2e/fixtures/utils/viewFileMocks'

class LayerEditorHelper {
  public readonly dialog: Locator
  public readonly layerRows: Locator
  public readonly moveDownButton: Locator
  public readonly undoButton: Locator
  public readonly redoButton: Locator
  public readonly xInput: Locator

  constructor(private readonly comfyPage: ComfyPage) {
    const { page } = comfyPage
    this.dialog = page.getByRole('dialog').filter({
      has: page.getByTestId('layer-panel-row')
    })
    this.layerRows = this.dialog.getByTestId('layer-panel-row')
    this.moveDownButton = this.dialog.getByRole('button', {
      name: 'Move layer down'
    })
    this.undoButton = this.dialog.getByRole('button', { name: 'Undo' })
    this.redoButton = this.dialog.getByRole('button', { name: 'Redo' })
    this.xInput = this.dialog.getByRole('spinbutton', { name: 'X' })
  }

  async open(): Promise<void> {
    const { comfyPage } = this
    await mockViewFiles(comfyPage.page, {
      'layer-one.webp': {
        contentType: 'image/webp',
        path: assetPath('image64x64.webp')
      },
      'layer-two.webp': {
        contentType: 'image/webp',
        path: assetPath('image32x32.webp')
      }
    })
    await comfyPage.settings.setSetting('Comfy.VueNodes.Enabled', true)
    await comfyPage.workflow.loadWorkflow('default')
    await comfyPage.vueNodes.waitForNodes()

    const saveImageNodes =
      await comfyPage.nodeOps.getNodeRefsByType('SaveImage')
    expect(
      saveImageNodes,
      'Default workflow should have one Save Image node'
    ).toHaveLength(1)
    const nodeId = String(saveImageNodes[0].id)

    await comfyPage.page.evaluate((id) => {
      window.app!.nodeOutputs[id] = {
        images: [
          { filename: 'layer-one.webp', subfolder: '', type: 'output' },
          { filename: 'layer-two.webp', subfolder: '', type: 'output' }
        ]
      }
    }, nodeId)

    const saveImage = await comfyPage.vueNodes.getFixtureByTitle('Save Image')
    await saveImageNodes[0].centerOnNode()
    const thumbnails = saveImage.imageGrid.getByRole('button')
    await expect(thumbnails).toHaveCount(2)
    await thumbnails.first().click()
    await saveImage.imagePreview.getByRole('region').hover()
    await saveImage.imagePreview.getByLabel('Open layer editor').click()

    await expect(this.dialog).toBeVisible()
    await expect(this.layerRows).toHaveCount(2)
  }

  async layerNames(): Promise<string[]> {
    return await this.layerRows.locator('span[title]').allTextContents()
  }
}

export const layerEditorTest = comfyPageFixture.extend<{
  layerEditor: LayerEditorHelper
}>({
  layerEditor: async ({ comfyPage }, use) => {
    const layerEditor = new LayerEditorHelper(comfyPage)
    await layerEditor.open()
    await use(layerEditor)
  }
})
