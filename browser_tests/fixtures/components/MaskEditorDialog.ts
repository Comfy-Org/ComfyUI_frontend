import type { Locator } from '@playwright/test'
import { expect } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'

/**
 * Page object for the mask editor dialog. Encapsulates the structural
 * locators that specs used to rebuild inline (undo/redo buttons, tool
 * entries, brush setting labels, etc.) so tests consume a single typed
 * surface instead of duplicating selectors.
 */
export class MaskEditorDialog {
  public readonly root: Locator
  public readonly heading: Locator

  // Canvas surface
  public readonly canvasContainer: Locator
  public readonly pointerZone: Locator

  // Header toolbar
  public readonly undoButton: Locator
  public readonly redoButton: Locator
  public readonly saveButton: Locator
  public readonly cancelButton: Locator
  public readonly invertButton: Locator
  public readonly clearButton: Locator

  // Tool panel
  public readonly toolPanel: Locator
  public readonly toolEntries: Locator
  public readonly selectedTool: Locator

  // Brush settings side panel
  public readonly thicknessLabel: Locator
  public readonly opacityLabel: Locator
  public readonly hardnessLabel: Locator

  constructor(public readonly comfyPage: ComfyPage) {
    const { page } = comfyPage
    this.root = page.locator('.mask-editor-dialog')
    this.heading = this.root.getByRole('heading', { name: 'Mask Editor' })

    this.canvasContainer = this.root.locator('#maskEditorCanvasContainer')
    this.pointerZone = this.root.getByTestId('mask-editor-pointer-zone')

    this.undoButton = this.root.getByRole('button', { name: 'Undo' })
    this.redoButton = this.root.getByRole('button', { name: 'Redo' })
    this.saveButton = this.root.getByRole('button', { name: 'Save' })
    this.cancelButton = this.root.getByRole('button', { name: 'Cancel' })
    this.invertButton = this.root.getByRole('button', { name: 'Invert' })
    this.clearButton = this.root.getByRole('button', { name: 'Clear' })

    this.toolPanel = this.root.locator('.maskEditor-ui-container')
    this.toolEntries = this.root.locator('.maskEditor_toolPanelContainer')
    this.selectedTool = this.root.locator(
      '.maskEditor_toolPanelContainerSelected'
    )

    this.thicknessLabel = this.root.getByText('Thickness')
    this.opacityLabel = this.root.getByText('Opacity').first()
    this.hardnessLabel = this.root.getByText('Hardness')
  }

  async waitForOpen(): Promise<void> {
    await expect(this.root).toBeVisible()
    await expect(this.heading).toBeVisible()
    await expect(this.canvasContainer).toBeVisible()
    await expect(this.canvasContainer.locator('canvas')).toHaveCount(4)
  }

  async getCanvasBoundingBox() {
    await expect(this.canvasContainer).toBeVisible()
    const box = await this.canvasContainer.boundingBox()
    if (!box)
      throw new Error('Mask editor canvas container bounding box not found')
    return box
  }

  /**
   * Moves the cursor off the pointer zone so PointerZone's pointerleave
   * clears store.brushVisible and the brush cursor overlay is removed from
   * the next paint. Call this before taking a canvas screenshot to avoid
   * flaky pixel diffs around the brush circle position.
   */
  async hideBrushCursor() {
    await this.comfyPage.page.mouse.move(0, 0)
    await this.comfyPage.nextFrame()
  }
}
