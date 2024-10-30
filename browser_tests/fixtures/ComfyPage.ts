import type { Page, Locator, APIRequestContext } from '@playwright/test'
import { expect } from '@playwright/test'
import { test as base } from '@playwright/test'
import { ComfyActionbar } from '../helpers/actionbar'
import dotenv from 'dotenv'
dotenv.config()
import * as fs from 'fs'
import { NodeBadgeMode } from '../../src/types/nodeSource'
import type { NodeId } from '../../src/types/comfyWorkflow'
import type { KeyCombo } from '../../src/types/keyBindingTypes'
import { ComfyTemplates } from '../helpers/templates'
import { ComfyNodeSearchBox } from './components/ComfyNodeSearchBox'
import {
  NodeLibrarySidebarTab,
  WorkflowsSidebarTab
} from './components/SidebarTab'
import { Topbar } from './components/Topbar'
import { NodeReference } from './utils/litegraphUtils'
import type { Position, Size } from './types'
import { SettingDialog } from './components/SettingDialog'

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

  get nodeLibraryTab() {
    return new NodeLibrarySidebarTab(this.page)
  }

  get workflowsTab() {
    return new WorkflowsSidebarTab(this.page)
  }

  get topbar() {
    return new Topbar(this.page)
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

type FolderStructure = {
  [key: string]: FolderStructure | string
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
  public readonly actionbar: ComfyActionbar
  public readonly templates: ComfyTemplates
  public readonly settingDialog: SettingDialog

  constructor(
    public readonly page: Page,
    public readonly request: APIRequestContext
  ) {
    this.url = process.env.PLAYWRIGHT_TEST_URL || 'http://localhost:8188'
    this.canvas = page.locator('#graph-canvas')
    this.widgetTextBox = page.getByPlaceholder('text').nth(1)
    this.resetViewButton = page.getByRole('button', { name: 'Reset View' })
    this.queueButton = page.getByRole('button', { name: 'Queue Prompt' })
    this.workflowUploadInput = page.locator('#comfy-file-input')
    this.searchBox = new ComfyNodeSearchBox(page)
    this.menu = new ComfyMenu(page)
    this.actionbar = new ComfyActionbar(page)
    this.templates = new ComfyTemplates(page)
    this.settingDialog = new SettingDialog(page)
  }

  convertLeafToContent(structure: FolderStructure): FolderStructure {
    const result: FolderStructure = {}

    for (const [key, value] of Object.entries(structure)) {
      if (typeof value === 'string') {
        const filePath = this.assetPath(value)
        result[key] = fs.readFileSync(filePath, 'utf-8')
      } else {
        result[key] = this.convertLeafToContent(value)
      }
    }

    return result
  }

  async getGraphNodesCount(): Promise<number> {
    return await this.page.evaluate(() => {
      return window['app']?.graph?.nodes?.length || 0
    })
  }

  async getSelectedGraphNodesCount(): Promise<number> {
    return await this.page.evaluate(() => {
      return (
        window['app']?.graph?.nodes?.filter(
          (node: any) => node.is_selected === true
        ).length || 0
      )
    })
  }

  async setupWorkflowsDirectory(structure: FolderStructure) {
    const resp = await this.request.post(
      `${this.url}/api/devtools/setup_folder_structure`,
      {
        data: {
          tree_structure: this.convertLeafToContent(structure),
          base_path: 'user/default/workflows'
        }
      }
    )

    if (resp.status() !== 200) {
      throw new Error(
        `Failed to setup workflows directory: ${await resp.text()}`
      )
    }
  }

  async setupSettings(settings: Record<string, any>) {
    const resp = await this.request.post(
      `${this.url}/api/devtools/set_settings`,
      {
        data: settings
      }
    )

    if (resp.status() !== 200) {
      throw new Error(`Failed to setup settings: ${await resp.text()}`)
    }
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
      () =>
        // window['app'] => GraphCanvas ready
        // window['app'].extensionManager => GraphView ready
        window['app'] && window['app'].extensionManager
    )
    await this.page.waitForSelector('.p-blockui-mask', { state: 'hidden' })
    await this.nextFrame()
  }

  public assetPath(fileName: string) {
    return `./browser_tests/assets/${fileName}`
  }

  async executeCommand(commandId: string) {
    await this.page.evaluate((id: string) => {
      return window['app'].extensionManager.command.execute(id)
    }, commandId)
  }

  async registerCommand(
    commandId: string,
    command: (() => void) | (() => Promise<void>)
  ) {
    await this.page.evaluate(
      ({ commandId, commandStr }) => {
        const app = window['app']
        const randomSuffix = Math.random().toString(36).substring(2, 8)
        const extensionName = `TestExtension_${randomSuffix}`

        app.registerExtension({
          name: extensionName,
          commands: [
            {
              id: commandId,
              function: eval(commandStr)
            }
          ]
        })
      },
      { commandId, commandStr: command.toString() }
    )
  }

  async registerKeybinding(keyCombo: KeyCombo, command: () => void) {
    await this.page.evaluate(
      ({ keyCombo, commandStr }) => {
        const app = window['app']
        const randomSuffix = Math.random().toString(36).substring(2, 8)
        const extensionName = `TestExtension_${randomSuffix}`
        const commandId = `TestCommand_${randomSuffix}`

        app.registerExtension({
          name: extensionName,
          keybindings: [
            {
              combo: keyCombo,
              commandId: commandId
            }
          ],
          commands: [
            {
              id: commandId,
              function: eval(commandStr)
            }
          ]
        })
      },
      { keyCombo, commandStr: command.toString() }
    )
  }

  async setSetting(settingId: string, settingValue: any) {
    return await this.page.evaluate(
      async ({ id, value }) => {
        await window['app'].extensionManager.setting.set(id, value)
      },
      { id: settingId, value: settingValue }
    )
  }

  async getSetting(settingId: string) {
    return await this.page.evaluate(async (id) => {
      return await window['app'].extensionManager.setting.get(id)
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

  async getVisibleToastCount() {
    return await this.page.locator('.p-toast:visible').count()
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
    const dialogInput = page.locator('.graphdialog input[type="text"]')
    await dialogInput.click()
    await dialogInput.fill('128')
    await dialogInput.press('Enter')
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

  async ctrlSend(keyToPress: string) {
    await this.page.keyboard.down('Control')
    await this.page.keyboard.press(keyToPress)
    await this.page.keyboard.up('Control')
    await this.nextFrame()
  }

  async ctrlA() {
    await this.ctrlSend('KeyA')
  }

  async ctrlB() {
    await this.ctrlSend('KeyB')
  }

  async ctrlC() {
    await this.ctrlSend('KeyC')
  }

  async ctrlV() {
    await this.ctrlSend('KeyV')
  }

  async ctrlZ() {
    await this.ctrlSend('KeyZ')
  }

  async ctrlY() {
    await this.ctrlSend('KeyY')
  }

  async ctrlArrowUp() {
    await this.ctrlSend('ArrowUp')
  }

  async ctrlArrowDown() {
    await this.ctrlSend('ArrowDown')
  }

  async closeMenu() {
    await this.page.click('button.comfy-close-menu-btn')
    await this.nextFrame()
  }

  async closeDialog() {
    await this.page.locator('.p-dialog-close-button').click()
    await expect(this.page.locator('.p-dialog')).toBeHidden()
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
    return Promise.all(
      (
        await this.page.evaluate((type) => {
          return window['app'].graph.nodes
            .filter((n) => n.type === type)
            .map((n) => n.id)
        }, type)
      ).map((id: NodeId) => this.getNodeRefById(id))
    )
  }
  async getFirstNodeRef(): Promise<NodeReference | null> {
    const id = await this.page.evaluate(() => {
      return window['app'].graph.nodes[0]?.id
    })
    if (!id) return null
    return this.getNodeRefById(id)
  }
  async moveMouseToEmptyArea() {
    await this.page.mouse.move(10, 10)
  }
}

export const comfyPageFixture = base.extend<{ comfyPage: ComfyPage }>({
  comfyPage: async ({ page, request }, use) => {
    const comfyPage = new ComfyPage(page, request)
    await comfyPage.setupSettings({
      // Hide canvas menu/info by default.
      'Comfy.Graph.CanvasInfo': false,
      'Comfy.Graph.CanvasMenu': false,
      // Hide all badges by default.
      'Comfy.NodeBadge.NodeIdBadgeMode': NodeBadgeMode.None,
      'Comfy.NodeBadge.NodeSourceBadgeMode': NodeBadgeMode.None,
      // Disable tooltips by default to avoid flakiness.
      'Comfy.EnableTooltips': false
    })
    await comfyPage.setup()
    await use(comfyPage)
  }
})

const makeMatcher = function <T>(
  getValue: (node: NodeReference) => Promise<T> | T,
  type: string
) {
  return async function (
    node: NodeReference,
    options?: { timeout?: number; intervals?: number[] }
  ) {
    const value = await getValue(node)
    let assertion = expect(
      value,
      'Node is ' + (this.isNot ? '' : 'not ') + type
    )
    if (this.isNot) {
      assertion = assertion.not
    }
    await expect(async () => {
      assertion.toBeTruthy()
    }).toPass({ timeout: 250, ...options })
    return {
      pass: !this.isNot,
      message: () => 'Node is ' + (this.isNot ? 'not ' : '') + type
    }
  }
}

export const comfyExpect = expect.extend({
  toBePinned: makeMatcher((n) => n.isPinned(), 'pinned'),
  toBeBypassed: makeMatcher((n) => n.isBypassed(), 'bypassed'),
  toBeCollapsed: makeMatcher((n) => n.isCollapsed(), 'collapsed')
})
