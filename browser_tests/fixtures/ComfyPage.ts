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
import type { useWorkspaceStore } from '../../src/stores/workspaceStore'
import { SettingDialog } from './components/SettingDialog'

type WorkspaceStore = ReturnType<typeof useWorkspaceStore>

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

type KeysOfType<T, Match> = {
  [K in keyof T]: T[K] extends Match ? K : never
}[keyof T]

class ConfirmDialog {
  public readonly delete: Locator
  public readonly overwrite: Locator
  public readonly reject: Locator

  constructor(public readonly page: Page) {
    this.delete = page.locator('button.p-button[aria-label="Delete"]')
    this.overwrite = page.locator('button.p-button[aria-label="Overwrite"]')
    this.reject = page.locator('button.p-button[aria-label="Cancel"]')
  }

  async click(locator: KeysOfType<ConfirmDialog, Locator>) {
    const loc = this[locator]
    await expect(loc).toBeVisible()
    await loc.click()
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
  public readonly actionbar: ComfyActionbar
  public readonly templates: ComfyTemplates
  public readonly settingDialog: SettingDialog
  public readonly confirmDialog: ConfirmDialog

  /** Worker index to test user ID */
  public readonly userIds: string[] = []

  /** Test user ID for the current context */
  get id() {
    return this.userIds[comfyPageFixture.info().parallelIndex]
  }

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
    this.confirmDialog = new ConfirmDialog(page)
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
          base_path: `user/${this.id}/workflows`
        }
      }
    )

    if (resp.status() !== 200) {
      throw new Error(
        `Failed to setup workflows directory: ${await resp.text()}`
      )
    }
  }

  async setupUser(username: string) {
    const res = await this.request.get(`${this.url}/api/users`)
    if (res.status() !== 200)
      throw new Error(`Failed to retrieve users: ${await res.text()}`)

    const apiRes = await res.json()
    const user = Object.entries(apiRes?.users ?? {}).find(
      ([, name]) => name === username
    )
    const id = user?.[0]

    return id ? id : await this.createUser(username)
  }

  async createUser(username: string) {
    const resp = await this.request.post(`${this.url}/api/users`, {
      data: { username }
    })

    if (resp.status() !== 200)
      throw new Error(`Failed to create user: ${await resp.text()}`)

    return await resp.json()
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

  async setup({ clearStorage = true }: { clearStorage?: boolean } = {}) {
    await this.goto()
    if (clearStorage) {
      await this.page.evaluate((id) => {
        localStorage.clear()
        sessionStorage.clear()
        localStorage.setItem('Comfy.userId', id)
      }, this.id)
    }
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

  async reload({ clearStorage = true }: { clearStorage?: boolean } = {}) {
    await this.page.reload({ timeout: 15000 })
    await this.setup({ clearStorage })
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

  async getToastErrorCount() {
    return await this.page
      .locator('.p-toast-message.p-toast-message-error')
      .count()
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

  get promptDialogInput() {
    return this.page.locator('.p-dialog-content input[type="text"]')
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

  async clickContextMenuItem(name: string): Promise<void> {
    await this.page.getByRole('menuitem', { name }).click()
    await this.nextFrame()
  }

  async doubleClickCanvas() {
    await this.page.mouse.dblclick(10, 10, { delay: 5 })
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

  async ctrlSend(keyToPress: string, locator: Locator | null = this.canvas) {
    const target = locator ?? this.page.keyboard
    await target.press(`Control+${keyToPress}`)
    await this.nextFrame()
  }

  async ctrlA(locator?: Locator | null) {
    await this.ctrlSend('KeyA', locator)
  }

  async ctrlB(locator?: Locator | null) {
    await this.ctrlSend('KeyB', locator)
  }

  async ctrlC(locator?: Locator | null) {
    await this.ctrlSend('KeyC', locator)
  }

  async ctrlV(locator?: Locator | null) {
    await this.ctrlSend('KeyV', locator)
  }

  async ctrlZ(locator?: Locator | null) {
    await this.ctrlSend('KeyZ', locator)
  }

  async ctrlY(locator?: Locator | null) {
    await this.ctrlSend('KeyY', locator)
  }

  async ctrlArrowUp(locator?: Locator | null) {
    await this.ctrlSend('ArrowUp', locator)
  }

  async ctrlArrowDown(locator?: Locator | null) {
    await this.ctrlSend('ArrowDown', locator)
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
    // -1 to be inside the node.  -2 because nodes currently get an arbitrary +1 to width.
    await this.dragAndDrop(
      { x: bottomRight.x - 2, y: bottomRight.y - 1 },
      target
    )
    await this.nextFrame()
    if (revertAfter) {
      await this.dragAndDrop({ x: target.x - 2, y: target.y - 1 }, bottomRight)
      await this.nextFrame()
    }
  }

  async resizeKsamplerNode(
    percentX: number,
    percentY: number,
    revertAfter: boolean = false
  ) {
    const ksamplerPos = {
      x: 863,
      y: 156
    }
    const ksamplerSize = {
      width: 315,
      height: 292
    }
    return this.resizeNode(
      ksamplerPos,
      ksamplerSize,
      percentX,
      percentY,
      revertAfter
    )
  }

  async resizeLoadCheckpointNode(
    percentX: number,
    percentY: number,
    revertAfter: boolean = false
  ) {
    const loadCheckpointPos = {
      x: 26,
      y: 444
    }
    const loadCheckpointSize = {
      width: 315,
      height: 127
    }
    return this.resizeNode(
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
      x: 473,
      y: 579
    }
    const emptyLatentSize = {
      width: 315,
      height: 136
    }
    return this.resizeNode(
      emptyLatentPos,
      emptyLatentSize,
      percentX,
      percentY,
      revertAfter
    )
  }

  async clickDialogButton(prompt: string, buttonText: string = 'Yes') {
    const modal = this.page.locator(
      `.comfy-modal-content:has-text("${prompt}")`
    )
    await expect(modal).toBeVisible()
    await modal
      .locator('.comfyui-button', {
        hasText: buttonText
      })
      .click()
    await expect(modal).toBeHidden()
  }

  async convertAllNodesToGroupNode(groupNodeName: string) {
    await this.canvas.press('Control+a')
    const node = await this.getFirstNodeRef()
    await node!.clickContextMenuOption('Convert to Group Node')
    await this.promptDialogInput.fill(groupNodeName)
    await this.page.keyboard.press('Enter')
    await this.promptDialogInput.waitFor({ state: 'hidden' })
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
  async getUndoQueueSize() {
    return this.page.evaluate(() => {
      const workflow = (window['app'].extensionManager as WorkspaceStore)
        .workflow.activeWorkflow
      return workflow?.changeTracker.undoQueue.length
    })
  }
  async getRedoQueueSize() {
    return this.page.evaluate(() => {
      const workflow = (window['app'].extensionManager as WorkspaceStore)
        .workflow.activeWorkflow
      return workflow?.changeTracker.redoQueue.length
    })
  }
  async isCurrentWorkflowModified() {
    return this.page.evaluate(() => {
      return (window['app'].extensionManager as WorkspaceStore).workflow
        .activeWorkflow?.isModified
    })
  }
}

export const comfyPageFixture = base.extend<{ comfyPage: ComfyPage }>({
  comfyPage: async ({ page, request }, use) => {
    const comfyPage = new ComfyPage(page, request)

    const { parallelIndex } = comfyPageFixture.info()
    const username = `playwright-test-${parallelIndex}`
    const userId = await comfyPage.setupUser(username)
    comfyPage.userIds[parallelIndex] = userId

    try {
      await comfyPage.setupSettings({
        'Comfy.UseNewMenu': 'Disabled',
        // Hide canvas menu/info by default.
        'Comfy.Graph.CanvasInfo': false,
        'Comfy.Graph.CanvasMenu': false,
        // Hide all badges by default.
        'Comfy.NodeBadge.NodeIdBadgeMode': NodeBadgeMode.None,
        'Comfy.NodeBadge.NodeSourceBadgeMode': NodeBadgeMode.None,
        // Disable tooltips by default to avoid flakiness.
        'Comfy.EnableTooltips': false,
        'Comfy.userId': userId
      })
    } catch (e) {
      console.error(e)
    }

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
