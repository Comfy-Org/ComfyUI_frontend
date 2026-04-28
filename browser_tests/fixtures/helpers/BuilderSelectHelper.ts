import type { Locator, Page } from '@playwright/test'

import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { TestIds } from '@e2e/fixtures/selectors'

/**
 * Drag an element from one index to another within a list of locators.
 * Uses mousedown/mousemove/mouseup to trigger the DraggableList library.
 *
 * DraggableList toggles position when the dragged item's center crosses
 * past an idle item's center. To reliably land at the target position,
 * we overshoot slightly past the target's far edge.
 */
async function dragByIndex(items: Locator, fromIndex: number, toIndex: number) {
  const fromBox = await items.nth(fromIndex).boundingBox()
  const toBox = await items.nth(toIndex).boundingBox()
  if (!fromBox || !toBox) throw new Error('Item not visible for drag')

  const draggingDown = toIndex > fromIndex
  const targetY = draggingDown
    ? toBox.y + toBox.height * 0.9
    : toBox.y + toBox.height * 0.1

  const page = items.page()
  await page.mouse.move(
    fromBox.x + fromBox.width / 2,
    fromBox.y + fromBox.height / 2
  )
  await page.mouse.down()
  await page.mouse.move(toBox.x + toBox.width / 2, targetY, { steps: 10 })
  await page.mouse.up()
}

export class BuilderSelectHelper {
  /** All IoItem locators in the current step sidebar. */
  public readonly inputItems: Locator
  /** All IoItem title locators in the inputs step sidebar. */
  public readonly inputItemTitles: Locator
  /** All widget label locators in the preview/arrange sidebar. */
  public readonly previewWidgetLabels: Locator

  constructor(private readonly comfyPage: ComfyPage) {
    this.inputItems = this.page.getByTestId(TestIds.builder.ioItem)
    this.inputItemTitles = this.page.getByTestId(TestIds.builder.ioItemTitle)
    this.previewWidgetLabels = this.page.getByTestId(
      TestIds.builder.widgetLabel
    )
  }

  private get page(): Page {
    return this.comfyPage.page
  }

  /**
   * Get the actions menu trigger for a builder IoItem (input-select sidebar).
   * @param title The widget title shown in the IoItem.
   */
  getInputItemMenu(title: string): Locator {
    return this.inputItems
      .filter({
        has: this.inputItemTitles.getByText(title, { exact: true })
      })
      .getByTestId(TestIds.builder.widgetActionsMenu)
  }

  /**
   * Get the actions menu trigger for a widget in the preview/arrange sidebar.
   * @param ariaLabel The aria-label on the widget row, e.g. "seed — KSampler".
   */
  getPreviewWidgetMenu(ariaLabel: string): Locator {
    return this.page
      .getByLabel(ariaLabel, { exact: true })
      .getByTestId(TestIds.builder.widgetActionsMenu)
  }

  /** Delete a builder input via its actions menu. */
  async deleteInput(title: string) {
    const menu = this.getInputItemMenu(title)
    await menu.click()
    await this.page.getByText('Delete', { exact: true }).click()
    await this.comfyPage.nextFrame()
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
      .getByText(title, { exact: true })
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

  /**
   * Click a widget on the canvas to select it as a builder input.
   * @param nodeTitle The displayed title of the node.
   * @param widgetName The widget name to click.
   */
  async selectInputWidget(nodeTitle: string, widgetName: string) {
    await this.comfyPage.canvasOps.setScale(1)
    const nodeRef = (
      await this.comfyPage.nodeOps.getNodeRefsByTitle(nodeTitle)
    )[0]
    if (!nodeRef) throw new Error(`Node ${nodeTitle} not found`)
    await nodeRef.centerOnNode()
    const widgetLocator = this.comfyPage.vueNodes
      .getNodeLocator(String(nodeRef.id))
      .getByLabel(widgetName, { exact: true })
    // oxlint-disable-next-line playwright/no-force-option -- Node container has conditional pointer-events:none that blocks actionability
    await widgetLocator.click({ force: true })
    await this.comfyPage.nextFrame()
  }

  /**
   * Get the subtitle locator for a builder IoItem by its title text.
   * Useful for asserting "Widget not visible" on disconnected inputs.
   */
  getInputItemSubtitle(title: string): Locator {
    return this.inputItems
      .filter({
        has: this.inputItemTitles.getByText(title, { exact: true })
      })
      .getByTestId(TestIds.builder.ioItemSubtitle)
  }

  /**
   * Drag an IoItem from one index to another in the inputs step.
   * Items are identified by their 0-based position among visible IoItems.
   */
  async dragInputItem(fromIndex: number, toIndex: number) {
    await dragByIndex(this.inputItems, fromIndex, toIndex)
    await this.comfyPage.nextFrame()
  }

  /**
   * Drag a widget item from one index to another in the preview/arrange step.
   */
  async dragPreviewItem(fromIndex: number, toIndex: number) {
    const items = this.page.getByTestId(TestIds.builder.widgetItem)
    await dragByIndex(items, fromIndex, toIndex)
    await this.comfyPage.nextFrame()
  }

  /**
   * Click an output node on the canvas to select it as a builder output.
   * @param nodeTitle The displayed title of the output node.
   */
  async selectOutputNode(nodeTitle: string) {
    await this.comfyPage.canvasOps.setScale(1)
    const nodeRef = (
      await this.comfyPage.nodeOps.getNodeRefsByTitle(nodeTitle)
    )[0]
    if (!nodeRef) throw new Error(`Node ${nodeTitle} not found`)
    await nodeRef.centerOnNode()
    const nodeLocator = this.comfyPage.vueNodes.getNodeLocator(
      String(nodeRef.id)
    )
    // oxlint-disable-next-line playwright/no-force-option -- Node container has conditional pointer-events:none that blocks actionability
    await nodeLocator.click({ force: true })
    await this.comfyPage.nextFrame()
  }
}
