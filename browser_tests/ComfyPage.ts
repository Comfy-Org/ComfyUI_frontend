import type { Page, Locator } from '@playwright/test'
import { test as base } from '@playwright/test'
import { expect } from '@playwright/test'
import dotenv from 'dotenv'
dotenv.config()
import * as fs from 'fs'
import { NodeBadgeMode } from '../src/types/nodeSource'
import { NodeId } from '../src/types/comfyWorkflow'
import { ManageGroupNode } from './helpers/manageGroupNode'

interface Position {
  x: number
  y: number
}

interface Size {
  width: number
  height: number
}

class ComfyNodeSearchFilterSelectionPanel {
  constructor(public readonly page: Page) {}

  async selectFilterType(filterType: string) {
    await this.page
      .locator(
        `.filter-type-select .p-togglebutton-label:has-text("${filterType}")`
      )
      .click()
  }

  async selectFilterValue(filterValue: string) {
    await this.page.locator('.filter-value-select .p-select-dropdown').click()
    await this.page
      .locator(
        `.p-select-overlay .p-select-list .p-select-option-label:text-is("${filterValue}")`
      )
      .click()
  }

  async addFilter(filterValue: string, filterType: string) {
    await this.selectFilterType(filterType)
    await this.selectFilterValue(filterValue)
    await this.page.locator('.p-button-label:has-text("Add")').click()
  }
}

class ComfyNodeSearchBox {
  public readonly input: Locator
  public readonly dropdown: Locator
  public readonly filterSelectionPanel: ComfyNodeSearchFilterSelectionPanel

  constructor(public readonly page: Page) {
    this.input = page.locator(
      '.comfy-vue-node-search-container input[type="text"]'
    )
    this.dropdown = page.locator(
      '.comfy-vue-node-search-container .p-autocomplete-list'
    )
    this.filterSelectionPanel = new ComfyNodeSearchFilterSelectionPanel(page)
  }

  get filterButton() {
    return this.page.locator('.comfy-vue-node-search-container ._filter-button')
  }

  async fillAndSelectFirstNode(
    nodeName: string,
    options?: { suggestionIndex: number }
  ) {
    await this.input.waitFor({ state: 'visible' })
    await this.input.fill(nodeName)
    await this.dropdown.waitFor({ state: 'visible' })
    // Wait for some time for the auto complete list to update.
    // The auto complete list is debounced and may take some time to update.
    await this.page.waitForTimeout(500)
    await this.dropdown
      .locator('li')
      .nth(options?.suggestionIndex || 0)
      .click()
  }

  async addFilter(filterValue: string, filterType: string) {
    await this.filterButton.click()
    await this.filterSelectionPanel.addFilter(filterValue, filterType)
  }

  get filterChips() {
    return this.page.locator(
      '.comfy-vue-node-search-container .p-autocomplete-chip-item'
    )
  }

  async removeFilter(index: number) {
    await this.filterChips.nth(index).locator('.p-chip-remove-icon').click()
  }
}

class NodeLibrarySidebarTab {
  public readonly tabId: string = 'node-library'
  constructor(public readonly page: Page) {}

  get tabButton() {
    return this.page.locator(`.${this.tabId}-tab-button`)
  }

  get selectedTabButton() {
    return this.page.locator(
      `.${this.tabId}-tab-button.side-bar-button-selected`
    )
  }

  get nodeLibrarySearchBoxInput() {
    return this.page.locator('.node-lib-search-box input[type="text"]')
  }

  get nodeLibraryTree() {
    return this.page.locator('.node-lib-tree-explorer')
  }

  get nodePreview() {
    return this.page.locator('.node-lib-node-preview')
  }

  get tabContainer() {
    return this.page.locator('.sidebar-content-container')
  }

  get newFolderButton() {
    return this.tabContainer.locator('.new-folder-button')
  }

  async open() {
    if (await this.selectedTabButton.isVisible()) {
      return
    }

    await this.tabButton.click()
    await this.nodeLibraryTree.waitFor({ state: 'visible' })
  }

  folderSelector(folderName: string) {
    return `.p-tree-node-content:has(> .tree-explorer-node-label:has(.tree-folder .node-label:has-text("${folderName}")))`
  }

  getFolder(folderName: string) {
    return this.page.locator(this.folderSelector(folderName))
  }

  nodeSelector(nodeName: string) {
    return `.p-tree-node-content:has(> .tree-explorer-node-label:has(.tree-leaf .node-label:has-text("${nodeName}")))`
  }

  getNode(nodeName: string) {
    return this.page.locator(this.nodeSelector(nodeName))
  }
}

class ComfyMenu {
  public readonly sideToolbar: Locator
  public readonly themeToggleButton: Locator
  public readonly saveButton: Locator

  constructor(public readonly page: Page) {
    this.sideToolbar = page.locator('.side-tool-bar-container')
    this.themeToggleButton = page.locator('.comfy-vue-theme-toggle')
    this.saveButton = page
      .locator('button[title="Save the current workflow"]')
      .nth(0)
  }

  async saveWorkflow(name: string) {
    const acceptDialog = async (dialog) => {
      await dialog.accept(name)
    }
    this.page.on('dialog', acceptDialog)

    await this.saveButton.click()

    // Wait a moment to ensure the dialog has been handled
    await this.page.waitForTimeout(300)

    // Remove the dialog listener
    this.page.off('dialog', acceptDialog)
  }

  get nodeLibraryTab() {
    return new NodeLibrarySidebarTab(this.page)
  }

  async toggleTheme() {
    await this.themeToggleButton.click()
    await this.page.evaluate(() => {
      return new Promise((resolve) => {
        window['app'].ui.settings.addEventListener(
          'Comfy.ColorPalette.change',
          resolve,
          { once: true }
        )

        setTimeout(resolve, 5000)
      })
    })
  }

  async getThemeId() {
    return await this.page.evaluate(async () => {
      return await window['app'].ui.settings.getSettingValue(
        'Comfy.ColorPalette'
      )
    })
  }
}

export class ComfyPage {
  public readonly url: string
  // All canvas position operations are based on default view of canvas.
  public readonly canvas: Locator
  public readonly widgetTextBox: Locator

  // Buttons
  public readonly resetViewButton: Locator
  public readonly queueButton: Locator

  // Inputs
  public readonly workflowUploadInput: Locator

  // Components
  public readonly searchBox: ComfyNodeSearchBox
  public readonly menu: ComfyMenu

  constructor(public readonly page: Page) {
    this.url = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
    this.canvas = page.locator('#graph-canvas')
    this.widgetTextBox = page.getByPlaceholder('text').nth(1)
    this.resetViewButton = page.getByRole('button', { name: 'Reset View' })
    this.queueButton = page.getByRole('button', { name: 'Queue Prompt' })
    this.workflowUploadInput = page.locator('#comfy-file-input')
    this.searchBox = new ComfyNodeSearchBox(page)
    this.menu = new ComfyMenu(page)
  }

  async getGraphNodesCount(): Promise<number> {
    return await this.page.evaluate(() => {
      return window['app']?.graph?.nodes?.length || 0
    })
  }

  async setup() {
    await this.goto()
    await this.page.evaluate(() => {
      localStorage.clear()
      sessionStorage.clear()
    })
    // Unify font for consistent screenshots.
    await this.page.addStyleTag({
      url: 'https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap'
    })
    await this.page.addStyleTag({
      url: 'https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&family=Roboto+Mono:ital,wght@0,100..700;1,100..700&family=Roboto:ital,wght@0,100;0,300;0,400;0,500;0,700;0,900;1,100;1,300;1,400;1,500;1,700;1,900&display=swap'
    })
    await this.page.addStyleTag({
      content: `
      * {
				font-family: 'Roboto Mono', 'Noto Color Emoji';
			}`
    })
    await this.page.waitForFunction(() => document.fonts.ready)
    await this.page.waitForFunction(
      () => window['app'] !== undefined && window['app'].vueAppReady
    )
    await this.page.evaluate(() => {
      window['app']['canvas'].show_info = false
    })
    await this.nextFrame()
    // Reset view to force re-rendering of canvas. So that info fields like fps
    // become hidden.
    await this.resetView()

    // Hide all badges by default.
    await this.setSetting('Comfy.NodeBadge.NodeIdBadgeMode', NodeBadgeMode.None)
    await this.setSetting(
      'Comfy.NodeBadge.NodeSourceBadgeMode',
      NodeBadgeMode.None
    )
  }

  public assetPath(fileName: string) {
    return `./browser_tests/assets/${fileName}`
  }

  async setSetting(settingId: string, settingValue: any) {
    return await this.page.evaluate(
      async ({ id, value }) => {
        await window['app'].ui.settings.setSettingValueAsync(id, value)
      },
      { id: settingId, value: settingValue }
    )
  }

  async getSetting(settingId: string) {
    return await this.page.evaluate(async (id) => {
      return await window['app'].ui.settings.getSettingValue(id)
    }, settingId)
  }

  async reload() {
    await this.page.reload({ timeout: 15000 })
    await this.setup()
  }

  async goto() {
    await this.page.goto(this.url)
  }

  async nextFrame() {
    await this.page.evaluate(() => {
      return new Promise<number>(requestAnimationFrame)
    })
  }

  async delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async loadWorkflow(workflowName: string) {
    await this.workflowUploadInput.setInputFiles(
      this.assetPath(`${workflowName}.json`)
    )
    await this.nextFrame()
  }

  async resetView() {
    if (await this.resetViewButton.isVisible()) {
      await this.resetViewButton.click()
    }
    // Avoid "Reset View" button highlight.
    await this.page.mouse.move(10, 10)
    await this.nextFrame()
  }

  async clickTextEncodeNode1() {
    await this.canvas.click({
      position: {
        x: 618,
        y: 191
      }
    })
    await this.nextFrame()
  }

  async clickTextEncodeNodeToggler() {
    await this.canvas.click({
      position: {
        x: 430,
        y: 171
      }
    })
    await this.nextFrame()
  }

  async clickTextEncodeNode2() {
    await this.canvas.click({
      position: {
        x: 622,
        y: 400
      }
    })
    await this.nextFrame()
  }

  async clickEmptySpace() {
    await this.canvas.click({
      position: {
        x: 35,
        y: 31
      }
    })
    await this.nextFrame()
  }

  async dragAndDrop(source: Position, target: Position) {
    await this.page.mouse.move(source.x, source.y)
    await this.page.mouse.down()
    await this.page.mouse.move(target.x, target.y)
    await this.page.mouse.up()
    await this.nextFrame()
  }

  async dragAndDropFile(fileName: string) {
    const filePath = this.assetPath(fileName)

    // Read the file content
    const buffer = fs.readFileSync(filePath)

    // Get file type
    const getFileType = (fileName: string) => {
      if (fileName.endsWith('.png')) return 'image/png'
      if (fileName.endsWith('.webp')) return 'image/webp'
      if (fileName.endsWith('.json')) return 'application/json'
      return 'application/octet-stream'
    }

    const fileType = getFileType(fileName)

    await this.page.evaluate(
      async ({ buffer, fileName, fileType }) => {
        const file = new File([new Uint8Array(buffer)], fileName, {
          type: fileType
        })
        const dataTransfer = new DataTransfer()
        dataTransfer.items.add(file)

        const dropEvent = new DragEvent('drop', {
          bubbles: true,
          cancelable: true,
          dataTransfer
        })

        Object.defineProperty(dropEvent, 'preventDefault', {
          value: () => {},
          writable: false
        })

        Object.defineProperty(dropEvent, 'stopPropagation', {
          value: () => {},
          writable: false
        })

        document.dispatchEvent(dropEvent)
      },
      { buffer: [...new Uint8Array(buffer)], fileName, fileType }
    )

    await this.nextFrame()
  }

  async dragNode2() {
    await this.dragAndDrop({ x: 622, y: 400 }, { x: 622, y: 300 })
    await this.nextFrame()
  }

  // Default graph positions
  get clipTextEncodeNode1InputSlot(): Position {
    return { x: 427, y: 198 }
  }

  get clipTextEncodeNode2InputSlot(): Position {
    return { x: 422, y: 402 }
  }

  // A point on input edge.
  get clipTextEncodeNode2InputLinkPath(): Position {
    return {
      x: 395,
      y: 422
    }
  }

  get loadCheckpointNodeClipOutputSlot(): Position {
    return { x: 332, y: 509 }
  }

  get emptySpace(): Position {
    return { x: 427, y: 98 }
  }

  async disconnectEdge() {
    await this.dragAndDrop(this.clipTextEncodeNode1InputSlot, this.emptySpace)
  }

  async connectEdge() {
    await this.dragAndDrop(
      this.loadCheckpointNodeClipOutputSlot,
      this.clipTextEncodeNode1InputSlot
    )
  }

  async adjustWidgetValue() {
    // Adjust Empty Latent Image's width input.
    const page = this.page
    await page.locator('#graph-canvas').click({
      position: {
        x: 724,
        y: 645
      }
    })
    await page.locator('input[type="text"]').click()
    await page.locator('input[type="text"]').fill('128')
    await page.locator('input[type="text"]').press('Enter')
    await this.nextFrame()
  }

  async zoom(deltaY: number, steps: number = 1) {
    await this.page.mouse.move(10, 10)
    for (let i = 0; i < steps; i++) {
      await this.page.mouse.wheel(0, deltaY)
    }
    await this.nextFrame()
  }

  async pan(offset: Position, safeSpot?: Position) {
    safeSpot = safeSpot || { x: 10, y: 10 }
    await this.page.mouse.move(safeSpot.x, safeSpot.y)
    await this.page.mouse.down()
    // TEMPORARY HACK: Multiple pans open the search menu, so cheat and keep it closed.
    // TODO: Fix that (double-click at not-the-same-coordinations should not open the menu)
    await this.page.keyboard.press('Escape')
    await this.page.mouse.move(offset.x + safeSpot.x, offset.y + safeSpot.y)
    await this.page.mouse.up()
    await this.nextFrame()
  }

  async panWithTouch(offset: Position, safeSpot?: Position) {
    safeSpot = safeSpot || { x: 10, y: 10 }
    const client = await this.page.context().newCDPSession(this.page)
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [safeSpot]
    })
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: offset.x + safeSpot.x, y: offset.y + safeSpot.y }]
    })
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: []
    })
    await this.nextFrame()
  }

  async rightClickCanvas() {
    await this.page.mouse.click(10, 10, { button: 'right' })
    await this.nextFrame()
  }

  async doubleClickCanvas() {
    await this.page.mouse.dblclick(10, 10)
    await this.nextFrame()
  }

  async clickEmptyLatentNode() {
    await this.canvas.click({
      position: {
        x: 724,
        y: 625
      }
    })
    this.page.mouse.move(10, 10)
    await this.nextFrame()
  }

  async rightClickEmptyLatentNode() {
    await this.canvas.click({
      position: {
        x: 724,
        y: 645
      },
      button: 'right'
    })
    this.page.mouse.move(10, 10)
    await this.nextFrame()
  }

  async select2Nodes() {
    // Select 2 CLIP nodes.
    await this.page.keyboard.down('Control')
    await this.clickTextEncodeNode1()
    await this.clickTextEncodeNode2()
    await this.page.keyboard.up('Control')
    await this.nextFrame()
  }

  async ctrlC() {
    await this.page.keyboard.down('Control')
    await this.page.keyboard.press('KeyC')
    await this.page.keyboard.up('Control')
    await this.nextFrame()
  }

  async ctrlV() {
    await this.page.keyboard.down('Control')
    await this.page.keyboard.press('KeyV')
    await this.page.keyboard.up('Control')
    await this.nextFrame()
  }

  async ctrlZ() {
    await this.page.keyboard.down('Control')
    await this.page.keyboard.press('KeyZ')
    await this.page.keyboard.up('Control')
    await this.nextFrame()
  }

  async ctrlY() {
    await this.page.keyboard.down('Control')
    await this.page.keyboard.press('KeyY')
    await this.page.keyboard.up('Control')
    await this.nextFrame()
  }

  async ctrlArrowUp() {
    await this.page.keyboard.down('Control')
    await this.page.keyboard.press('ArrowUp')
    await this.page.keyboard.up('Control')
    await this.nextFrame()
  }

  async ctrlArrowDown() {
    await this.page.keyboard.down('Control')
    await this.page.keyboard.press('ArrowDown')
    await this.page.keyboard.up('Control')
    await this.nextFrame()
  }

  async closeMenu() {
    await this.page.click('button.comfy-close-menu-btn')
    await this.nextFrame()
  }

  async resizeNode(
    nodePos: Position,
    nodeSize: Size,
    ratioX: number,
    ratioY: number,
    revertAfter: boolean = false
  ) {
    const bottomRight = {
      x: nodePos.x + nodeSize.width,
      y: nodePos.y + nodeSize.height
    }
    const target = {
      x: nodePos.x + nodeSize.width * ratioX,
      y: nodePos.y + nodeSize.height * ratioY
    }
    await this.dragAndDrop(bottomRight, target)
    await this.nextFrame()
    if (revertAfter) {
      await this.dragAndDrop(target, bottomRight)
      await this.nextFrame()
    }
  }

  async resizeKsamplerNode(
    percentX: number,
    percentY: number,
    revertAfter: boolean = false
  ) {
    const ksamplerPos = {
      x: 864,
      y: 157
    }
    const ksamplerSize = {
      width: 315,
      height: 292
    }
    this.resizeNode(ksamplerPos, ksamplerSize, percentX, percentY, revertAfter)
  }

  async resizeLoadCheckpointNode(
    percentX: number,
    percentY: number,
    revertAfter: boolean = false
  ) {
    const loadCheckpointPos = {
      x: 25,
      y: 440
    }
    const loadCheckpointSize = {
      width: 320,
      height: 120
    }
    this.resizeNode(
      loadCheckpointPos,
      loadCheckpointSize,
      percentX,
      percentY,
      revertAfter
    )
  }

  async resizeEmptyLatentNode(
    percentX: number,
    percentY: number,
    revertAfter: boolean = false
  ) {
    const emptyLatentPos = {
      x: 475,
      y: 580
    }
    const emptyLatentSize = {
      width: 303,
      height: 132
    }
    this.resizeNode(
      emptyLatentPos,
      emptyLatentSize,
      percentX,
      percentY,
      revertAfter
    )
  }

  async convertAllNodesToGroupNode(groupNodeName: string) {
    this.page.on('dialog', async (dialog) => {
      await dialog.accept(groupNodeName)
    })
    await this.canvas.press('Control+a')
    const node = await this.getFirstNodeRef()
    await node!.clickContextMenuOption('Convert to Group Node')
    await this.nextFrame()
  }
  async convertOffsetToCanvas(pos: [number, number]) {
    return this.page.evaluate((pos) => {
      return window['app'].canvas.ds.convertOffsetToCanvas(pos)
    }, pos)
  }
  async getNodeRefById(id: NodeId) {
    return new NodeReference(id, this)
  }
  async getNodeRefsByType(type: string): Promise<NodeReference[]> {
    return (
      await this.page.evaluate((type) => {
        return window['app'].graph.nodes
          .filter((n) => n.type === type)
          .map((n) => n.id)
      }, type)
    ).map((id: NodeId) => this.getNodeRefById(id))
  }
  async getFirstNodeRef(): Promise<NodeReference | null> {
    const id = await this.page.evaluate(() => {
      return window['app'].graph.nodes[0]?.id
    })
    if (!id) return null
    return this.getNodeRefById(id)
  }
}
class NodeSlotReference {
  constructor(
    readonly type: 'input' | 'output',
    readonly index: number,
    readonly node: NodeReference
  ) {}
  async getPosition() {
    const pos: [number, number] = await this.node.comfyPage.page.evaluate(
      ([type, id, index]) => {
        const node = window['app'].graph.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found.`)
        return window['app'].canvas.ds.convertOffsetToCanvas(
          node.getConnectionPos(type === 'input', index)
        )
      },
      [this.type, this.node.id, this.index] as const
    )
    return {
      x: pos[0],
      y: pos[1]
    }
  }
  async getLinkCount() {
    return await this.node.comfyPage.page.evaluate(
      ([type, id, index]) => {
        const node = window['app'].graph.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found.`)
        if (type === 'input') {
          return node.inputs[index].link == null ? 0 : 1
        }
        return node.outputs[index].links?.length ?? 0
      },
      [this.type, this.node.id, this.index] as const
    )
  }
  async removeLinks() {
    await this.node.comfyPage.page.evaluate(
      ([type, id, index]) => {
        const node = window['app'].graph.getNodeById(id)
        if (!node) throw new Error(`Node ${id} not found.`)
        if (type === 'input') {
          node.disconnectInput(index)
        } else {
          node.disconnectOutput(index)
        }
      },
      [this.type, this.node.id, this.index] as const
    )
  }
}
class NodeReference {
  constructor(
    readonly id: NodeId,
    readonly comfyPage: ComfyPage
  ) {}
  async exists(): Promise<boolean> {
    return await this.comfyPage.page.evaluate((id) => {
      const node = window['app'].graph.getNodeById(id)
      return !!node
    }, this.id)
  }
  getType(): Promise<string> {
    return this.getProperty('type')
  }
  async getPosition(): Promise<Position> {
    const pos = await this.comfyPage.convertOffsetToCanvas(
      await this.getProperty<[number, number]>('pos')
    )
    return {
      x: pos[0],
      y: pos[1]
    }
  }
  async getSize(): Promise<Size> {
    const size = await this.getProperty<[number, number]>('size')
    return {
      width: size[0],
      height: size[1]
    }
  }
  async getProperty<T>(prop: string): Promise<T> {
    return await this.comfyPage.page.evaluate(
      ([id, prop]) => {
        const node = window['app'].graph.getNodeById(id)
        if (!node) throw new Error('Node not found')
        return node[prop]
      },
      [this.id, prop] as const
    )
  }
  async getOutput(index: number) {
    return new NodeSlotReference('output', index, this)
  }
  async getInput(index: number) {
    return new NodeSlotReference('input', index, this)
  }
  async click(position: 'title', options?: Parameters<Page['click']>[1]) {
    const nodePos = await this.getPosition()
    const nodeSize = await this.getSize()
    let clickPos: Position
    switch (position) {
      case 'title':
        clickPos = { x: nodePos.x + nodeSize.width / 2, y: nodePos.y + 15 }
        break
      default:
        throw new Error(`Invalid click position ${position}`)
    }
    await this.comfyPage.canvas.click({
      ...options,
      position: clickPos
    })
    await this.comfyPage.nextFrame()
  }
  async connectOutput(
    originSlotIndex: number,
    targetNode: NodeReference,
    targetSlotIndex: number
  ) {
    const originSlot = await this.getOutput(originSlotIndex)
    const targetSlot = await targetNode.getInput(targetSlotIndex)
    await this.comfyPage.dragAndDrop(
      await originSlot.getPosition(),
      await targetSlot.getPosition()
    )
    return originSlot
  }
  async clickContextMenuOption(optionText: string) {
    await this.click('title', { button: 'right' })
    const ctx = this.comfyPage.page.locator('.litecontextmenu')
    await ctx.getByText(optionText).click()
  }
  async convertToGroupNode(groupNodeName: string = 'GroupNode') {
    this.comfyPage.page.once('dialog', async (dialog) => {
      await dialog.accept(groupNodeName)
    })
    await this.clickContextMenuOption('Convert to Group Node')
    await this.comfyPage.nextFrame()
    const nodes = await this.comfyPage.getNodeRefsByType(
      `workflow/${groupNodeName}`
    )
    if (nodes.length !== 1) {
      throw new Error(`Did not find single group node (found=${nodes.length})`)
    }
    return nodes[0]
  }
  async manageGroupNode() {
    await this.clickContextMenuOption('Manage Group Node')
    await this.comfyPage.nextFrame()
    return new ManageGroupNode(
      this.comfyPage.page,
      this.comfyPage.page.locator('.comfy-group-manage')
    )
  }
}

export const comfyPageFixture = base.extend<{ comfyPage: ComfyPage }>({
  comfyPage: async ({ page }, use) => {
    const comfyPage = new ComfyPage(page)
    await comfyPage.setup()
    await use(comfyPage)
  }
})
