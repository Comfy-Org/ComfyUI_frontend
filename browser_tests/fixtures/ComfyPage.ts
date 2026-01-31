import type { APIRequestContext, Locator, Page } from '@playwright/test'
import { test as base, expect } from '@playwright/test'
import dotenv from 'dotenv'
import * as fs from 'fs'

import type { LGraphNode, LGraph } from '../../src/lib/litegraph/src/litegraph'
import type { NodeId } from '../../src/platform/workflow/validation/schemas/workflowSchema'
import type { KeyCombo } from '../../src/platform/keybindings'
import type { useWorkspaceStore } from '../../src/stores/workspaceStore'
import { NodeBadgeMode } from '../../src/types/nodeSource'
import { ComfyActionbar } from '../helpers/actionbar'
import { ComfyTemplates } from '../helpers/templates'
import { ComfyMouse } from './ComfyMouse'
import { VueNodeHelpers } from './VueNodeHelpers'
import { ComfyNodeSearchBox } from './components/ComfyNodeSearchBox'
import { SettingDialog } from './components/SettingDialog'
import {
  NodeLibrarySidebarTab,
  WorkflowsSidebarTab
} from './components/SidebarTab'
import { Topbar } from './components/Topbar'
import { DefaultGraphPositions } from './constants/defaultGraphPositions'
import { DebugHelper } from './helpers/DebugHelper'
import type { Position, Size } from './types'
import { NodeReference, SubgraphSlotReference } from './utils/litegraphUtils'

dotenv.config()

type WorkspaceStore = ReturnType<typeof useWorkspaceStore>

class ComfyPropertiesPanel {
  readonly root: Locator
  readonly panelTitle: Locator
  readonly searchBox: Locator

  constructor(readonly page: Page) {
    this.root = page.getByTestId('properties-panel')
    this.panelTitle = this.root.locator('h3')
    this.searchBox = this.root.getByPlaceholder('Search...')
  }
}

class ComfyMenu {
  private _nodeLibraryTab: NodeLibrarySidebarTab | null = null
  private _workflowsTab: WorkflowsSidebarTab | null = null
  private _topbar: Topbar | null = null

  public readonly sideToolbar: Locator
  public readonly propertiesPanel: ComfyPropertiesPanel
  public readonly themeToggleButton: Locator
  public readonly saveButton: Locator

  constructor(public readonly page: Page) {
    this.sideToolbar = page.locator('.side-tool-bar-container')
    this.themeToggleButton = page.locator('.comfy-vue-theme-toggle')
    this.propertiesPanel = new ComfyPropertiesPanel(page)
    this.saveButton = page
      .locator('button[title="Save the current workflow"]')
      .nth(0)
  }

  get buttons() {
    return this.sideToolbar.locator('.side-bar-button')
  }

  get nodeLibraryTab() {
    this._nodeLibraryTab ??= new NodeLibrarySidebarTab(this.page)
    return this._nodeLibraryTab
  }

  get workflowsTab() {
    this._workflowsTab ??= new WorkflowsSidebarTab(this.page)
    return this._workflowsTab
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
  private readonly root: Locator
  public readonly delete: Locator
  public readonly overwrite: Locator
  public readonly reject: Locator
  public readonly confirm: Locator

  constructor(public readonly page: Page) {
    this.root = page.getByRole('dialog')
    this.delete = this.root.getByRole('button', { name: 'Delete' })
    this.overwrite = this.root.getByRole('button', { name: 'Overwrite' })
    this.reject = this.root.getByRole('button', { name: 'Cancel' })
    this.confirm = this.root.getByRole('button', { name: 'Confirm' })
  }

  async click(locator: KeysOfType<ConfirmDialog, Locator>) {
    const loc = this[locator]
    await loc.waitFor({ state: 'visible' })
    await loc.click()

    // Wait for the dialog mask to disappear after confirming
    const mask = this.page.locator('.p-dialog-mask')
    const count = await mask.count()
    if (count > 0) {
      await mask.first().waitFor({ state: 'hidden', timeout: 3000 })
    }

    // Wait for workflow service to finish if it's busy
    await this.page.waitForFunction(
      () => window['app']?.extensionManager?.workflow?.isBusy === false,
      undefined,
      { timeout: 3000 }
    )
  }
}

export class ComfyPage {
  public readonly url: string
  // All canvas position operations are based on default view of canvas.
  public readonly canvas: Locator
  public readonly selectionToolbox: Locator
  public readonly widgetTextBox: Locator

  // Buttons
  public readonly resetViewButton: Locator
  public readonly queueButton: Locator // Run button in Legacy UI
  public readonly runButton: Locator // Run button (renamed "Queue" -> "Run")

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
  public readonly vueNodes: VueNodeHelpers
  public readonly debug: DebugHelper

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
    this.selectionToolbox = page.locator('.selection-toolbox')
    this.widgetTextBox = page.getByPlaceholder('text').nth(1)
    this.resetViewButton = page.getByRole('button', { name: 'Reset View' })
    this.queueButton = page.getByRole('button', { name: 'Queue Prompt' })
    this.runButton = page
      .getByTestId('queue-button')
      .getByRole('button', { name: 'Run' })
    this.workflowUploadInput = page.locator('#comfy-file-input')
    this.visibleToasts = page.locator('.p-toast-message:visible')

    this.searchBox = new ComfyNodeSearchBox(page)
    this.menu = new ComfyMenu(page)
    this.actionbar = new ComfyActionbar(page)
    this.templates = new ComfyTemplates(page)
    this.settingDialog = new SettingDialog(page, this)
    this.confirmDialog = new ConfirmDialog(page)
    this.vueNodes = new VueNodeHelpers(page)
    this.debug = new DebugHelper(page, this.canvas)
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

    // Wait for Vue to re-render the workflow list
    await this.nextFrame()
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

  async setup({
    clearStorage = true,
    mockReleases = true
  }: {
    clearStorage?: boolean
    mockReleases?: boolean
  } = {}) {
    await this.goto()

    // Mock release endpoint to prevent changelog popups
    if (mockReleases) {
      await this.page.route('**/releases**', async (route) => {
        const url = route.request().url()
        if (
          url.includes('api.comfy.org') ||
          url.includes('stagingapi.comfy.org')
        ) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify([])
          })
        } else {
          await route.continue()
        }
      })
    }

    if (clearStorage) {
      await this.page.evaluate((id) => {
        localStorage.clear()
        sessionStorage.clear()
        localStorage.setItem('Comfy.userId', id)
      }, this.id)
    }
    await this.goto()

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

  /**
   * Attach a screenshot to the test report.
   * By default, screenshots are only taken in non-CI environments.
   * @param name - Name for the screenshot attachment
   * @param options - Optional configuration
   * @param options.runInCI - Whether to take screenshot in CI (default: false)
   * @param options.fullPage - Whether to capture full page (default: false)
   */
  async attachScreenshot(
    name: string,
    options: { runInCI?: boolean; fullPage?: boolean } = {}
  ) {
    const { runInCI = false, fullPage = false } = options

    // Skip in CI unless explicitly requested
    if (process.env.CI && !runInCI) {
      return
    }

    const testInfo = comfyPageFixture.info()
    await testInfo.attach(name, {
      body: await this.page.screenshot({ fullPage }),
      contentType: 'image/png'
    })
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
    if (requireCount) {
      await this.visibleToasts
        .nth(requireCount - 1)
        .waitFor({ state: 'visible' })
    }

    // Clear all toasts
    const toastCloseButtons = await this.page
      .locator('.p-toast-close-button')
      .all()
    for (const button of toastCloseButtons) {
      await button.click()
    }

    // Wait for toasts to disappear
    await this.visibleToasts
      .first()
      .waitFor({ state: 'hidden', timeout: 1000 })
      .catch(() => {})
  }

  async clickTextEncodeNode1() {
    await this.canvas.click({
      position: DefaultGraphPositions.textEncodeNode1
    })
    await this.nextFrame()
  }

  async clickTextEncodeNodeToggler() {
    await this.canvas.click({
      position: DefaultGraphPositions.textEncodeNodeToggler
    })
    await this.nextFrame()
  }

  async clickTextEncodeNode2() {
    await this.canvas.click({
      position: DefaultGraphPositions.textEncodeNode2
    })
    await this.nextFrame()
  }

  async clickEmptySpace() {
    await this.canvas.click({
      position: DefaultGraphPositions.emptySpaceClick
    })
    await this.nextFrame()
  }

  async dragAndDrop(source: Position, target: Position) {
    await this.page.mouse.move(source.x, source.y)
    await this.page.mouse.down()
    await this.page.mouse.move(target.x, target.y, { steps: 100 })
    await this.page.mouse.up()
    await this.nextFrame()
  }

  async dragAndDropExternalResource(
    options: {
      fileName?: string
      url?: string
      dropPosition?: Position
      waitForUpload?: boolean
    } = {}
  ) {
    const {
      dropPosition = { x: 100, y: 100 },
      fileName,
      url,
      waitForUpload = false
    } = options

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
        if (fileName.endsWith('.avif')) return 'image/avif'
        return 'application/octet-stream'
      }

      evaluateParams.fileName = fileName
      evaluateParams.fileType = getFileType(fileName)
      evaluateParams.buffer = [...new Uint8Array(buffer)]
    }

    // Dropping a URL (e.g., dropping image across browser tabs in Firefox)
    if (url) evaluateParams.url = url

    // Set up response waiter for file uploads before triggering the drop
    const uploadResponsePromise = waitForUpload
      ? this.page.waitForResponse(
          (resp) => resp.url().includes('/upload/') && resp.status() === 200,
          { timeout: 10000 }
        )
      : null

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

    // Wait for file upload to complete
    if (uploadResponsePromise) {
      await uploadResponsePromise
    }

    await this.nextFrame()
  }

  async dragAndDropFile(
    fileName: string,
    options: { dropPosition?: Position; waitForUpload?: boolean } = {}
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
    return DefaultGraphPositions.clipTextEncodeNode1InputSlot
  }

  get clipTextEncodeNode2InputSlot(): Position {
    return DefaultGraphPositions.clipTextEncodeNode2InputSlot
  }

  // A point on input edge.
  get clipTextEncodeNode2InputLinkPath(): Position {
    return DefaultGraphPositions.clipTextEncodeNode2InputLinkPath
  }

  get loadCheckpointNodeClipOutputSlot(): Position {
    return DefaultGraphPositions.loadCheckpointNodeClipOutputSlot
  }

  get emptySpace(): Position {
    return DefaultGraphPositions.emptySpace
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
      position: DefaultGraphPositions.emptyLatentWidgetClick
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

  async rightClickCanvas(x: number = 10, y: number = 10) {
    await this.page.mouse.click(x, y, { button: 'right' })
    await this.nextFrame()
  }

  async clickContextMenuItem(name: string): Promise<void> {
    await this.page.getByRole('menuitem', { name }).click()
    await this.nextFrame()
  }

  /**
   * Clicks on a litegraph context menu item (uses .litemenu-entry selector).
   * Use this for canvas/node context menus, not PrimeVue menus.
   */
  async clickLitegraphContextMenuItem(name: string): Promise<void> {
    await this.page.locator(`.litemenu-entry:has-text("${name}")`).click()
    await this.nextFrame()
  }

  /**
   * Core helper method for interacting with subgraph I/O slots.
   * Handles both input/output slots and both right-click/double-click actions.
   *
   * @param slotType - 'input' or 'output'
   * @param action - 'rightClick' or 'doubleClick'
   * @param slotName - Optional specific slot name to target
   * @private
   */
  private async interactWithSubgraphSlot(
    slotType: 'input' | 'output',
    action: 'rightClick' | 'doubleClick',
    slotName?: string
  ): Promise<void> {
    const foundSlot = await this.page.evaluate(
      async (params) => {
        const { slotType, action, targetSlotName } = params
        const app = window['app']
        const currentGraph = app.canvas.graph

        // Check if we're in a subgraph
        if (currentGraph.constructor.name !== 'Subgraph') {
          throw new Error(
            'Not in a subgraph - this method only works inside subgraphs'
          )
        }

        // Get the appropriate node and slots
        const node =
          slotType === 'input'
            ? currentGraph.inputNode
            : currentGraph.outputNode
        const slots =
          slotType === 'input' ? currentGraph.inputs : currentGraph.outputs

        if (!node) {
          throw new Error(`No ${slotType} node found in subgraph`)
        }

        if (!slots || slots.length === 0) {
          throw new Error(`No ${slotType} slots found in subgraph`)
        }

        // Filter slots based on target name and action type
        const slotsToTry = targetSlotName
          ? slots.filter((slot) => slot.name === targetSlotName)
          : action === 'rightClick'
            ? slots
            : [slots[0]] // Right-click tries all, double-click uses first

        if (slotsToTry.length === 0) {
          throw new Error(
            targetSlotName
              ? `${slotType} slot '${targetSlotName}' not found`
              : `No ${slotType} slots available to try`
          )
        }

        // Handle the interaction based on action type
        if (action === 'rightClick') {
          // Right-click: try each slot until one works
          for (const slot of slotsToTry) {
            if (!slot.pos) continue

            const event = {
              canvasX: slot.pos[0],
              canvasY: slot.pos[1],
              button: 2, // Right mouse button
              preventDefault: () => {},
              stopPropagation: () => {}
            }

            if (node.onPointerDown) {
              node.onPointerDown(
                event,
                app.canvas.pointer,
                app.canvas.linkConnector
              )
            }

            // Wait briefly for menu to appear
            await new Promise((resolve) => setTimeout(resolve, 100))

            // Check if context menu appeared
            const menuExists = document.querySelector('.litemenu-entry')
            if (menuExists) {
              return {
                success: true,
                slotName: slot.name,
                x: slot.pos[0],
                y: slot.pos[1]
              }
            }
          }
        } else if (action === 'doubleClick') {
          // Double-click: use first slot with bounding rect center
          const slot = slotsToTry[0]
          if (!slot.boundingRect) {
            throw new Error(`${slotType} slot bounding rect not found`)
          }

          const rect = slot.boundingRect
          const testX = rect[0] + rect[2] / 2 // x + width/2
          const testY = rect[1] + rect[3] / 2 // y + height/2

          const event = {
            canvasX: testX,
            canvasY: testY,
            button: 0, // Left mouse button
            preventDefault: () => {},
            stopPropagation: () => {}
          }

          if (node.onPointerDown) {
            node.onPointerDown(
              event,
              app.canvas.pointer,
              app.canvas.linkConnector
            )

            // Trigger double-click
            if (app.canvas.pointer.onDoubleClick) {
              app.canvas.pointer.onDoubleClick(event)
            }
          }

          // Wait briefly for dialog to appear
          await new Promise((resolve) => setTimeout(resolve, 200))

          return { success: true, slotName: slot.name, x: testX, y: testY }
        }

        return { success: false }
      },
      { slotType, action, targetSlotName: slotName }
    )

    if (!foundSlot.success) {
      const actionText =
        action === 'rightClick' ? 'open context menu for' : 'double-click'
      throw new Error(
        slotName
          ? `Could not ${actionText} ${slotType} slot '${slotName}'`
          : `Could not find any ${slotType} slot to ${actionText}`
      )
    }

    // Wait for the appropriate UI element to appear
    if (action === 'rightClick') {
      await this.page.waitForSelector('.litemenu-entry', {
        state: 'visible',
        timeout: 5000
      })
    } else {
      await this.nextFrame()
    }
  }

  /**
   * Right-clicks on a subgraph input slot to open the context menu.
   * Must be called when inside a subgraph.
   *
   * This method uses the actual slot positions from the subgraph.inputs array,
   * which contain the correct coordinates for each input slot. These positions
   * are different from the visual node positions and are specifically where
   * the slots are rendered on the input node.
   *
   * @param inputName Optional name of the specific input slot to target (e.g., 'text').
   *                  If not provided, tries all available input slots until one works.
   * @returns Promise that resolves when the context menu appears
   */
  async rightClickSubgraphInputSlot(inputName?: string): Promise<void> {
    return this.interactWithSubgraphSlot('input', 'rightClick', inputName)
  }

  /**
   * Right-clicks on a subgraph output slot to open the context menu.
   * Must be called when inside a subgraph.
   *
   * Similar to rightClickSubgraphInputSlot but for output slots.
   *
   * @param outputName Optional name of the specific output slot to target.
   *                   If not provided, tries all available output slots until one works.
   * @returns Promise that resolves when the context menu appears
   */
  async rightClickSubgraphOutputSlot(outputName?: string): Promise<void> {
    return this.interactWithSubgraphSlot('output', 'rightClick', outputName)
  }

  /**
   * Double-clicks on a subgraph input slot to rename it.
   * Must be called when inside a subgraph.
   *
   * @param inputName Optional name of the specific input slot to target (e.g., 'text').
   *                  If not provided, tries the first available input slot.
   * @returns Promise that resolves when the rename dialog appears
   */
  async doubleClickSubgraphInputSlot(inputName?: string): Promise<void> {
    return this.interactWithSubgraphSlot('input', 'doubleClick', inputName)
  }

  /**
   * Double-clicks on a subgraph output slot to rename it.
   * Must be called when inside a subgraph.
   *
   * @param outputName Optional name of the specific output slot to target.
   *                   If not provided, tries the first available output slot.
   * @returns Promise that resolves when the rename dialog appears
   */
  async doubleClickSubgraphOutputSlot(outputName?: string): Promise<void> {
    return this.interactWithSubgraphSlot('output', 'doubleClick', outputName)
  }

  /**
   * Get a reference to a subgraph input slot
   */
  async getSubgraphInputSlot(
    slotName?: string
  ): Promise<SubgraphSlotReference> {
    return new SubgraphSlotReference('input', slotName || '', this)
  }

  /**
   * Get a reference to a subgraph output slot
   */
  async getSubgraphOutputSlot(
    slotName?: string
  ): Promise<SubgraphSlotReference> {
    return new SubgraphSlotReference('output', slotName || '', this)
  }

  /**
   * Connect a regular node output to a subgraph input.
   * This creates a new input slot on the subgraph if targetInputName is not provided.
   */
  async connectToSubgraphInput(
    sourceNode: NodeReference,
    sourceSlotIndex: number,
    targetInputName?: string
  ): Promise<void> {
    const sourceSlot = await sourceNode.getOutput(sourceSlotIndex)
    const targetSlot = await this.getSubgraphInputSlot(targetInputName)

    const targetPosition = targetInputName
      ? await targetSlot.getPosition() // Connect to existing slot
      : await targetSlot.getOpenSlotPosition() // Create new slot

    await this.dragAndDrop(await sourceSlot.getPosition(), targetPosition)
    await this.nextFrame()
  }

  /**
   * Connect a subgraph input to a regular node input.
   * This creates a new input slot on the subgraph if sourceInputName is not provided.
   */
  async connectFromSubgraphInput(
    targetNode: NodeReference,
    targetSlotIndex: number,
    sourceInputName?: string
  ): Promise<void> {
    const sourceSlot = await this.getSubgraphInputSlot(sourceInputName)
    const targetSlot = await targetNode.getInput(targetSlotIndex)

    const sourcePosition = sourceInputName
      ? await sourceSlot.getPosition() // Connect from existing slot
      : await sourceSlot.getOpenSlotPosition() // Create new slot

    const targetPosition = await targetSlot.getPosition()

    await this.dragAndDrop(sourcePosition, targetPosition)
    await this.nextFrame()
  }

  /**
   * Connect a regular node output to a subgraph output.
   * This creates a new output slot on the subgraph if targetOutputName is not provided.
   */
  async connectToSubgraphOutput(
    sourceNode: NodeReference,
    sourceSlotIndex: number,
    targetOutputName?: string
  ): Promise<void> {
    const sourceSlot = await sourceNode.getOutput(sourceSlotIndex)
    const targetSlot = await this.getSubgraphOutputSlot(targetOutputName)

    const targetPosition = targetOutputName
      ? await targetSlot.getPosition() // Connect to existing slot
      : await targetSlot.getOpenSlotPosition() // Create new slot

    await this.dragAndDrop(await sourceSlot.getPosition(), targetPosition)
    await this.nextFrame()
  }

  /**
   * Connect a subgraph output to a regular node input.
   * This creates a new output slot on the subgraph if sourceOutputName is not provided.
   */
  async connectFromSubgraphOutput(
    targetNode: NodeReference,
    targetSlotIndex: number,
    sourceOutputName?: string
  ): Promise<void> {
    const sourceSlot = await this.getSubgraphOutputSlot(sourceOutputName)
    const targetSlot = await targetNode.getInput(targetSlotIndex)

    const sourcePosition = sourceOutputName
      ? await sourceSlot.getPosition() // Connect from existing slot
      : await sourceSlot.getOpenSlotPosition() // Create new slot

    await this.dragAndDrop(sourcePosition, await targetSlot.getPosition())
    await this.nextFrame()
  }

  /** @deprecated Use this.debug.addMarker() instead */
  async debugAddMarker(
    position: Position,
    id: string = 'debug-marker'
  ): Promise<void> {
    return this.debug.addMarker(position, id)
  }

  /** @deprecated Use this.debug.removeMarkers() instead */
  async debugRemoveMarkers(): Promise<void> {
    return this.debug.removeMarkers()
  }

  /** @deprecated Use this.debug.attachScreenshot() instead */
  async debugAttachScreenshot(
    testInfo: any,
    name: string,
    options?: {
      fullPage?: boolean
      element?: 'canvas' | 'page'
      markers?: Array<{ position: Position; id?: string }>
    }
  ): Promise<void> {
    return this.debug.attachScreenshot(testInfo, name, options)
  }

  async doubleClickCanvas() {
    await this.page.mouse.dblclick(10, 10, { delay: 5 })
    await this.nextFrame()
  }

  /** @deprecated Use this.debug.saveCanvasScreenshot() instead */
  async debugSaveCanvasScreenshot(filename: string): Promise<void> {
    return this.debug.saveCanvasScreenshot(filename)
  }

  /** @deprecated Use this.debug.getCanvasDataURL() instead */
  async debugGetCanvasDataURL(): Promise<string> {
    return this.debug.getCanvasDataURL()
  }

  /** @deprecated Use this.debug.showCanvasOverlay() instead */
  async debugShowCanvasOverlay(): Promise<void> {
    return this.debug.showCanvasOverlay()
  }

  /** @deprecated Use this.debug.hideCanvasOverlay() instead */
  async debugHideCanvasOverlay(): Promise<void> {
    return this.debug.hideCanvasOverlay()
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
    await this.page.locator('.p-dialog-close-button').click({ force: true })
    await this.page.locator('.p-dialog').waitFor({ state: 'hidden' })
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
    return this.resizeNode(
      DefaultGraphPositions.ksampler.pos,
      DefaultGraphPositions.ksampler.size,
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
    return this.resizeNode(
      DefaultGraphPositions.loadCheckpoint.pos,
      DefaultGraphPositions.loadCheckpoint.size,
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
    return this.resizeNode(
      DefaultGraphPositions.emptyLatent.pos,
      DefaultGraphPositions.emptyLatent.size,
      percentX,
      percentY,
      revertAfter
    )
  }

  async clickDialogButton(prompt: string, buttonText: string = 'Yes') {
    const modal = this.page.locator(
      `.comfy-modal-content:has-text("${prompt}")`
    )
    await modal.waitFor({ state: 'visible' })
    await modal
      .locator('.comfyui-button', {
        hasText: buttonText
      })
      .click()
    await modal.waitFor({ state: 'hidden' })
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
  async waitForGraphNodes(count: number) {
    await this.page.waitForFunction((count) => {
      return window['app']?.canvas.graph?.nodes?.length === count
    }, count)
  }
  async getNodeRefsByType(
    type: string,
    includeSubgraph: boolean = false
  ): Promise<NodeReference[]> {
    return Promise.all(
      (
        await this.page.evaluate(
          ({ type, includeSubgraph }) => {
            const graph = (
              includeSubgraph ? window['app'].canvas.graph : window['app'].graph
            ) as LGraph
            const nodes = graph.nodes
            return nodes
              .filter((n: LGraphNode) => n.type === type)
              .map((n: LGraphNode) => n.id)
          },
          { type, includeSubgraph }
        )
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

  /**
   * Get the position of a group by title.
   * @param title The title of the group to find
   * @returns The group's canvas position
   * @throws Error if group not found
   */
  async getGroupPosition(title: string): Promise<Position> {
    const pos = await this.page.evaluate((title) => {
      const groups = window['app'].graph.groups
      const group = groups.find((g: { title: string }) => g.title === title)
      if (!group) return null
      return { x: group.pos[0], y: group.pos[1] }
    }, title)
    if (!pos) throw new Error(`Group "${title}" not found`)
    return pos
  }

  /**
   * Drag a group by its title.
   * @param options.name The title of the group to drag
   * @param options.deltaX Horizontal drag distance in screen pixels
   * @param options.deltaY Vertical drag distance in screen pixels
   */
  async dragGroup(options: {
    name: string
    deltaX: number
    deltaY: number
  }): Promise<void> {
    const { name, deltaX, deltaY } = options
    const screenPos = await this.page.evaluate((title) => {
      const app = window['app']
      const groups = app.graph.groups
      const group = groups.find((g: { title: string }) => g.title === title)
      if (!group) return null
      // Position in the title area of the group
      const clientPos = app.canvasPosToClientPos([
        group.pos[0] + 50,
        group.pos[1] + 15
      ])
      return { x: clientPos[0], y: clientPos[1] }
    }, name)
    if (!screenPos) throw new Error(`Group "${name}" not found`)

    await this.dragAndDrop(screenPos, {
      x: screenPos.x + deltaX,
      y: screenPos.y + deltaY
    })
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
        'Comfy.UseNewMenu': 'Top',
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
        'Comfy.SnapToGrid.GridSize': testComfySnapToGridGridSize,
        'Comfy.VueNodes.AutoScaleLayout': false,
        // Disable toast warning about version compatibility, as they may or
        // may not appear - depending on upstream ComfyUI dependencies
        'Comfy.VersionCompatibility.DisableWarnings': true
      })
    } catch (e) {
      console.error(e)
    }

    await comfyPage.setup()
    await use(comfyPage)
  },
  comfyMouse: async ({ comfyPage }, use) => {
    const comfyMouse = new ComfyMouse(comfyPage)
    await use(comfyMouse)
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
