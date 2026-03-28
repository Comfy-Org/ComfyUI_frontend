import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '../ComfyPage'
import type { NodeReference } from '../utils/litegraphUtils'
import { TestIds } from '../selectors'

export class BuilderSelectHelper {
  constructor(private readonly comfyPage: ComfyPage) {}

  private get page(): Page {
    return this.comfyPage.page
  }

  /**
   * Get the actions menu trigger for a builder IoItem (input-select sidebar).
   * @param title The widget title shown in the IoItem.
   */
  getInputItemMenu(title: string): Locator {
    return this.page
      .getByTestId(TestIds.builder.ioItem)
      .filter({ hasText: title })
      .getByTestId(TestIds.builder.widgetActionsMenu)
  }

  /**
   * Get the actions menu trigger for a widget in the preview/arrange sidebar.
   * @param ariaLabel The aria-label on the widget row, e.g. "seed — KSampler".
   */
  getPreviewWidgetMenu(ariaLabel: string): Locator {
    return this.page
      .locator(`[aria-label="${ariaLabel}"]`)
      .getByTestId(TestIds.builder.widgetActionsMenu)
  }

  /**
   * Rename a builder IoItem via the popover menu "Rename" action.
   * @param title The current widget title shown in the IoItem.
   * @param newName The new name to assign.
   */
  async renameInputViaMenu(title: string, newName: string) {
    const menu = this.getInputItemMenu(title)
    await menu.click()
    await this.page.getByText('Rename', { exact: true }).click()

    const input = this.page
      .getByTestId(TestIds.builder.ioItemTitle)
      .getByRole('textbox')
    await input.fill(newName)
    await this.page.keyboard.press('Enter')
    await this.comfyPage.nextFrame()
  }

  /**
   * Rename a builder IoItem by double-clicking its title for inline editing.
   * @param title The current widget title shown in the IoItem.
   * @param newName The new name to assign.
   */
  async renameInput(title: string, newName: string) {
    const titleEl = this.page
      .getByTestId(TestIds.builder.ioItemTitle)
      .filter({ hasText: title })
    await titleEl.dblclick()

    const input = this.page
      .getByTestId(TestIds.builder.ioItemTitle)
      .getByRole('textbox')
    await input.fill(newName)
    await this.page.keyboard.press('Enter')
    await this.comfyPage.nextFrame()
  }

  /**
   * Rename a widget via its actions popover (works in preview and app mode).
   * @param popoverTrigger The button that opens the widget's actions popover.
   * @param newName The new name to assign.
   */
  async renameWidget(popoverTrigger: Locator, newName: string) {
    await popoverTrigger.click()
    await this.page.getByText('Rename', { exact: true }).click()

    const dialogInput = this.page.locator(
      '.p-dialog-content input[type="text"]'
    )
    await dialogInput.fill(newName)
    await this.page.keyboard.press('Enter')
    await dialogInput.waitFor({ state: 'hidden' })
    await this.comfyPage.nextFrame()
  }

  /** Center on a node and click its first widget to select it as input. */
  async selectInputWidget(node: NodeReference) {
    await this.comfyPage.canvasOps.setScale(1)
    await node.centerOnNode()

    const widgetRef = await node.getWidget(0)
    const widgetPos = await widgetRef.getPosition()
    const titleHeight = await this.page.evaluate(
      () => window.LiteGraph!['NODE_TITLE_HEIGHT'] as number
    )
    await this.page.mouse.click(widgetPos.x, widgetPos.y + titleHeight)
    await this.comfyPage.nextFrame()
  }

  /** Click the first SaveImage/PreviewImage node on the canvas. */
  async selectOutputNode() {
    const saveImageNodeId = await this.page.evaluate(() =>
      String(
        window.app!.rootGraph.nodes.find(
          (n: { type?: string }) =>
            n.type === 'SaveImage' || n.type === 'PreviewImage'
        )?.id
      )
    )
    const saveImageRef =
      await this.comfyPage.nodeOps.getNodeRefById(saveImageNodeId)
    await saveImageRef.centerOnNode()

    const canvasBox = await this.page.locator('#graph-canvas').boundingBox()
    if (!canvasBox) throw new Error('Canvas not found')
    await this.page.mouse.click(
      canvasBox.x + canvasBox.width / 2,
      canvasBox.y + canvasBox.height / 2
    )
    await this.comfyPage.nextFrame()
  }
}
