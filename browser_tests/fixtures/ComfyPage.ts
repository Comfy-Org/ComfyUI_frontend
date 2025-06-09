import type { LGraphNode } from '@comfyorg/litegraph'
import type { APIRequestContext, Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'
import { test as base } from '@playwright/test'
import dotenv from 'dotenv'
import * as fs from 'fs'

import type { NodeId } from '../../src/schemas/comfyWorkflowSchema'
import type { KeyCombo } from '../../src/schemas/keyBindingSchema'
import type { useWorkspaceStore } from '../../src/stores/workspaceStore'
import { NodeBadgeMode } from '../../src/types/nodeSource'
import { ComfyActionbar } from '../helpers/actionbar'
import { ComfyTemplates } from '../helpers/templates'
import { ComfyMouse } from './ComfyMouse'
import { ComfyNodeSearchBox } from './components/ComfyNodeSearchBox'
import { SettingDialog } from './components/SettingDialog'
import {
  NodeLibrarySidebarTab,
  QueueSidebarTab,
  WorkflowsSidebarTab
} from './components/SidebarTab'
import { Topbar } from './components/Topbar'
import type { Position, Size } from './types'
import { NodeReference } from './utils/litegraphUtils'
import TaskHistory from './utils/taskHistory'

dotenv.config()

type WorkspaceStore = ReturnType<typeof useWorkspaceStore>

class ComfyMenu {
  private _nodeLibraryTab: NodeLibrarySidebarTab | null = null
  private _workflowsTab: WorkflowsSidebarTab | null = null
  private _queueTab: QueueSidebarTab | null = null
  private _topbar: Topbar | null = null

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
    this._nodeLibraryTab ??= new NodeLibrarySidebarTab(this.page)
    return this._nodeLibraryTab
  }

  get workflowsTab() {
    this._workflowsTab ??= new WorkflowsSidebarTab(this.page)
    return this._workflowsTab
  }

  get queueTab() {
    this._queueTab ??= new QueueSidebarTab(this.page)
    return this._queueTab
  }

  get topbar() {
    this._topbar ??= new Topbar(this.page)
    return this._topbar
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
  public readonly confirm: Locator

  constructor(public readonly page: Page) {
    this.delete = page.locator('button.p-button[aria-label="Delete"]')
    this.overwrite = page.locator('button.p-button[aria-label="Overwrite"]')
    this.reject = page.locator('button.p-button[aria-label="Cancel"]')
    this.confirm = page.locator('button.p-button[aria-label="Confirm"]')
  }

  async click(locator: KeysOfType<ConfirmDialog, Locator>) {
    const loc = this[locator]
    await expect(loc).toBeVisible()
    await loc.click()
  }
}

export class ComfyPage {
  private _history: TaskHistory | null = null

  public readonly url: string
  // All canvas position operations are based on default view of canvas.
  public readonly canvas: Locator
  public readonly widgetTextBox: Locator

  // Buttons
  public readonly resetViewButton: Locator
  public readonly queueButton: Locator

  // Inputs
  public readonly workflowUploadInput: Locator

  // Toasts
  public readonly visibleToasts: Locator

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
    this.visibleToasts = page.locator('.p-toast-message:visible')

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

    await this.page.evaluate(async () => {
      await window['app'].extensionManager.workflow.syncWorkflows()
    })
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

  setupHistory(): TaskHistory {
    this._history ??= new TaskHistory(this)
    return this._history
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

  async deleteWorkflow(
    workflowName: string,
    whenMissing: 'ignoreMissing' | 'throwIfMissing' = 'ignoreMissing'
  ) {
    // Open workflows tab
    const { workflowsTab } = this.menu
    await workflowsTab.open()

    // Action to take if workflow missing
    if (whenMissing === 'ignoreMissing') {
      const workflows = await workflowsTab.getTopLevelSavedWorkflowNames()
      if (!workflows.includes(workflowName)) return
    }

    // Delete workflow
    await workflowsTab.getPersistedItem(workflowName).click({ button: 'right' })
    await this.clickContextMenuItem('Delete')
    await this.confirmDialog.delete.click()

    // Clear toast & close tab
    await this.closeToasts(1)
    await workflowsTab.close()
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
    return await this.visibleToasts.count()
  }

  async closeToasts(requireCount = 0) {
    if (requireCount) await expect(this.visibleToasts).toHaveCount(requireCount)

    // Clear all toasts
    const toastCloseButtons = await this.page
      .locator('.p-toast-close-button')
      .all()
    for (const button of toastCloseButtons) {
      await button.click()
    }
    await expect(this.visibleToasts).toHaveCount(0)
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

  async dragAndDropExternalResource(
    options: {
      fileName?: string
      url?: string
      dropPosition?: Position
    } = {}
  ) {
    const { dropPosition = { x: 100, y: 100 }, fileName, url } = options

    if (!fileName && !url)
      throw new Error('Must provide either fileName or url')

    const evaluateParams: {
      dropPosition: Position
      fileName?: string
      fileType?: string
      buffer?: Uint8Array | number[]
      url?: string
    } = { dropPosition }

    // Dropping a file from the filesystem
    if (fileName) {
      const filePath = this.assetPath(fileName)
      const buffer = fs.readFileSync(filePath)

      const getFileType = (fileName: string) => {
        if (fileName.endsWith('.png')) return 'image/png'
        if (fileName.endsWith('.svg')) return 'image/svg+xml'
        if (fileName.endsWith('.webp')) return 'image/webp'
        if (fileName.endsWith('.webm')) return 'video/webm'
        if (fileName.endsWith('.json')) return 'application/json'
        if (fileName.endsWith('.glb')) return 'model/gltf-binary'
        return 'application/octet-stream'
      }

      evaluateParams.fileName = fileName
      evaluateParams.fileType = getFileType(fileName)
      evaluateParams.buffer = [...new Uint8Array(buffer)]
    }

    // Dropping a URL (e.g., dropping image across browser tabs in Firefox)
    if (url) evaluateParams.url = url

    // Execute the drag and drop in the browser
    await this.page.evaluate(async (params) => {
      const dataTransfer = new DataTransfer()

      // Add file if provided
      if (params.buffer && params.fileName && params.fileType) {
        const file = new File(
          [new Uint8Array(params.buffer)],
          params.fileName,
          {
            type: params.fileType
          }
        )
        dataTransfer.items.add(file)
      }

      // Add URL data if provided
      if (params.url) {
        dataTransfer.setData('text/uri-list', params.url)
        dataTransfer.setData('text/x-moz-url', params.url)
      }

      const targetElement = document.elementFromPoint(
        params.dropPosition.x,
        params.dropPosition.y
      )

      if (!targetElement) {
        console.error('No element found at drop position:', params.dropPosition)
        return { success: false, error: 'No element at position' }
      }

      const eventOptions = {
        bubbles: true,
        cancelable: true,
        dataTransfer,
        clientX: params.dropPosition.x,
        clientY: params.dropPosition.y
      }

      const dragOverEvent = new DragEvent('dragover', eventOptions)
      const dropEvent = new DragEvent('drop', eventOptions)

      Object.defineProperty(dropEvent, 'preventDefault', {
        value: () => {},
        writable: false
      })

      Object.defineProperty(dropEvent, 'stopPropagation', {
        value: () => {},
        writable: false
      })

      targetElement.dispatchEvent(dragOverEvent)
      targetElement.dispatchEvent(dropEvent)

      return {
        success: true,
        targetInfo: {
          tagName: targetElement.tagName,
          id: targetElement.id,
          classList: Array.from(targetElement.classList)
        }
      }
    }, evaluateParams)

    await this.nextFrame()
  }

  async dragAndDropFile(
    fileName: string,
    options: { dropPosition?: Position } = {}
  ) {
    return this.dragAndDropExternalResource({ fileName, ...options })
  }

  async dragAndDropURL(url: string, options: { dropPosition?: Position } = {}) {
    return this.dragAndDropExternalResource({ url, ...options })
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

  async fillPromptDialog(value: string) {
    await this.promptDialogInput.fill(value)
    await this.page.keyboard.press('Enter')
    await this.promptDialogInput.waitFor({ state: 'hidden' })
    await this.nextFrame()
  }

  async disconnectEdge() {
    await this.dragAndDrop(this.clipTextEncodeNode1InputSlot, this.emptySpace)
  }

  async connectEdge(
    options: {
      reverse?: boolean
    } = {}
  ) {
    const { reverse = false } = options
    const start = reverse
      ? this.clipTextEncodeNode1InputSlot
      : this.loadCheckpointNodeClipOutputSlot
    const end = reverse
      ? this.loadCheckpointNodeClipOutputSlot
      : this.clipTextEncodeNode1InputSlot

    await this.dragAndDrop(start, end)
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
    await this.page.mouse.move(10, 10)
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
    await this.page.mouse.move(10, 10)
    await this.nextFrame()
  }

  async selectNodes(nodeTitles: string[]) {
    await this.page.keyboard.down('Control')
    for (const nodeTitle of nodeTitles) {
      const nodes = await this.getNodeRefsByTitle(nodeTitle)
      for (const node of nodes) {
        await node.click('title')
      }
    }
    await this.page.keyboard.up('Control')
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
    await this.fillPromptDialog(groupNodeName)
    await this.nextFrame()
  }

  async convertOffsetToCanvas(pos: [number, number]) {
    return this.page.evaluate((pos) => {
      return window['app'].canvas.ds.convertOffsetToCanvas(pos)
    }, pos)
  }

  /** Get number of DOM widgets on the canvas. */
  async getDOMWidgetCount() {
    return await this.page.locator('.dom-widget').count()
  }

  async getNodeRefById(id: NodeId) {
    return new NodeReference(id, this)
  }
  async getNodes(): Promise<LGraphNode[]> {
    return await this.page.evaluate(() => {
      return window['app'].graph.nodes
    })
  }
  async getNodeRefsByType(type: string): Promise<NodeReference[]> {
    return Promise.all(
      (
        await this.page.evaluate((type) => {
          return window['app'].graph.nodes
            .filter((n: LGraphNode) => n.type === type)
            .map((n: LGraphNode) => n.id)
        }, type)
      ).map((id: NodeId) => this.getNodeRefById(id))
    )
  }
  async getNodeRefsByTitle(title: string): Promise<NodeReference[]> {
    return Promise.all(
      (
        await this.page.evaluate((title) => {
          return window['app'].graph.nodes
            .filter((n: LGraphNode) => n.title === title)
            .map((n: LGraphNode) => n.id)
        }, title)
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
  async getExportedWorkflow({ api = false }: { api?: boolean } = {}) {
    return this.page.evaluate(async (api) => {
      return (await window['app'].graphToPrompt())[api ? 'output' : 'workflow']
    }, api)
  }
  async setFocusMode(focusMode: boolean) {
    await this.page.evaluate((focusMode) => {
      window['app'].extensionManager.focusMode = focusMode
    }, focusMode)
    await this.nextFrame()
  }
}

export const testComfySnapToGridGridSize = 50

export const comfyPageFixture = base.extend<{
  comfyPage: ComfyPage
  comfyMouse: ComfyMouse
}>({
  comfyPage: async ({ page, request }, use, testInfo) => {
    const comfyPage = new ComfyPage(page, request)

    const { parallelIndex } = testInfo
    const username = `playwright-test-${parallelIndex}`
    const userId = await comfyPage.setupUser(username)
    comfyPage.userIds[parallelIndex] = userId

    try {
      await comfyPage.setupSettings({
        'Comfy.UseNewMenu': 'Disabled',
        // Hide canvas menu/info/selection toolbox by default.
        'Comfy.Graph.CanvasInfo': false,
        'Comfy.Graph.CanvasMenu': false,
        'Comfy.Canvas.SelectionToolbox': false,
        // Hide all badges by default.
        'Comfy.NodeBadge.NodeIdBadgeMode': NodeBadgeMode.None,
        'Comfy.NodeBadge.NodeSourceBadgeMode': NodeBadgeMode.None,
        // Disable tooltips by default to avoid flakiness.
        'Comfy.EnableTooltips': false,
        'Comfy.userId': userId,
        // Set tutorial completed to true to avoid loading the tutorial workflow.
        'Comfy.TutorialCompleted': true,
        'Comfy.SnapToGrid.GridSize': testComfySnapToGridGridSize
      })
    } catch (e) {
      console.error(e)
    }

    await comfyPage.setup()
    await use(comfyPage)
  },
  comfyMouse: async ({ comfyPage }, use) => {
    const comfyMouse = new ComfyMouse(comfyPage)
    use(comfyMouse)
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
  toBeCollapsed: makeMatcher((n) => n.isCollapsed(), 'collapsed'),
  async toHaveFocus(locator: Locator, options = { timeout: 256 }) {
    const isFocused = await locator.evaluate(
      (el) => el === document.activeElement
    )

    await expect(async () => {
      expect(isFocused).toBe(!this.isNot)
    }).toPass(options)

    return {
      pass: isFocused,
      message: () => `Expected element to ${isFocused ? 'not ' : ''}be focused.`
    }
  }
})
