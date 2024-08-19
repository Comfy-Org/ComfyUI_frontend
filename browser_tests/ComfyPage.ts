import type { Page, Locator } from '@playwright/test'
import { test as base } from '@playwright/test'
import dotenv from 'dotenv'
dotenv.config()

interface Position {
  x: number
  y: number
}

interface Size {
  width: number
  height: number
}

class ComfyNodeSearchBox {
  public readonly input: Locator
  public readonly dropdown: Locator

  constructor(public readonly page: Page) {
    this.input = page.locator(
      '.comfy-vue-node-search-container input[type="text"]'
    )
    this.dropdown = page.locator(
      '.comfy-vue-node-search-container .p-autocomplete-list'
    )
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

  get nodeLibraryTree() {
    return this.page.locator('.node-lib-tree')
  }

  get nodePreview() {
    return this.page.locator('.node-lib-node-preview')
  }

  async open() {
    if (await this.selectedTabButton.isVisible()) {
      return
    }

    await this.tabButton.click()
    await this.nodeLibraryTree.waitFor({ state: 'visible' })
  }

  async toggleFirstFolder() {
    await this.page.locator('.p-tree-node-toggle-button').nth(0).click()
  }
}

class ComfyMenu {
  public readonly sideToolbar: Locator
  public readonly themeToggleButton: Locator

  constructor(public readonly page: Page) {
    this.sideToolbar = page.locator('.side-tool-bar-container')
    this.themeToggleButton = page.locator('.comfy-vue-theme-toggle')
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
    this.workflowUploadInput = page.locator('#comfy-file-input')
    this.searchBox = new ComfyNodeSearchBox(page)
    this.menu = new ComfyMenu(page)
  }

  async getGraphNodesCount(): Promise<number> {
    return await this.page.evaluate(() => {
      return window['app']?.graph?._nodes?.length || 0
    })
  }

  async setup() {
    await this.goto()
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
  }

  async setSetting(settingId: string, settingValue: any) {
    return await this.page.evaluate(
      async ({ id, value }) => {
        await window['app'].ui.settings.setSettingValueAsync(id, value)
      },
      { id: settingId, value: settingValue }
    )
  }

  async realod() {
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

  async loadWorkflow(workflowName: string) {
    await this.workflowUploadInput.setInputFiles(
      `./browser_tests/assets/${workflowName}.json`
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

  async dragNode2() {
    await this.dragAndDrop({ x: 622, y: 400 }, { x: 622, y: 300 })
    await this.nextFrame()
  }

  async disconnectEdge() {
    // CLIP input anchor
    await this.page.mouse.move(427, 198)
    await this.page.mouse.down()
    await this.page.mouse.move(427, 98)
    await this.page.mouse.up()
    // Move out the way to avoid highlight of menu item.
    await this.page.mouse.move(10, 10)
    await this.nextFrame()
  }

  async connectEdge() {
    // CLIP output anchor on Load Checkpoint Node.
    await this.page.mouse.move(332, 509)
    await this.page.mouse.down()
    // CLIP input anchor on CLIP Text Encode Node.
    await this.page.mouse.move(427, 198)
    await this.page.mouse.up()
    await this.nextFrame()
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

  async zoom(deltaY: number) {
    await this.page.mouse.move(10, 10)
    await this.page.mouse.wheel(0, deltaY)
    await this.nextFrame()
  }

  async pan(offset: Position) {
    await this.page.mouse.move(10, 10)
    await this.page.mouse.down()
    await this.page.mouse.move(offset.x, offset.y)
    await this.page.mouse.up()
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
}

export const comfyPageFixture = base.extend<{ comfyPage: ComfyPage }>({
  comfyPage: async ({ page }, use) => {
    const comfyPage = new ComfyPage(page)
    await comfyPage.setup()
    await use(comfyPage)
  }
})
