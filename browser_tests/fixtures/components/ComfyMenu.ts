import type { Locator, Page } from '@playwright/test'

import { PropertiesPanel } from '@e2e/fixtures/components/PropertiesPanel'
import {
  AssetsSidebarTab,
  ModelLibrarySidebarTab,
  NodeLibrarySidebarTab,
  NodeLibrarySidebarTabV2,
  SidebarTab,
  WorkflowsSidebarTab
} from '@e2e/fixtures/components/SidebarTab'
import { Topbar } from '@e2e/fixtures/components/Topbar'
import { TestIds } from '@e2e/fixtures/selectors'

export class ComfyMenu {
  private _appsTab: SidebarTab | null = null
  private _jobHistoryTab: SidebarTab | null = null
  private _assetsTab: AssetsSidebarTab | null = null
  private _modelLibraryTab: ModelLibrarySidebarTab | null = null
  private _nodeLibraryTab: NodeLibrarySidebarTab | null = null
  private _nodeLibraryTabV2: NodeLibrarySidebarTabV2 | null = null
  private _workflowsTab: WorkflowsSidebarTab | null = null
  private _topbar: Topbar | null = null

  public readonly sideToolbar: Locator
  public readonly propertiesPanel: PropertiesPanel
  public readonly modeToggleButton: Locator
  public readonly buttons: Locator

  constructor(public readonly page: Page) {
    this.sideToolbar = page.getByTestId(TestIds.sidebar.toolbar)
    this.modeToggleButton = page.getByTestId(TestIds.sidebar.modeToggle)
    this.propertiesPanel = new PropertiesPanel(page)
    this.buttons = this.sideToolbar.locator('.side-bar-button')
  }

  get modelLibraryTab() {
    this._modelLibraryTab ??= new ModelLibrarySidebarTab(this.page)
    return this._modelLibraryTab
  }

  get nodeLibraryTab() {
    this._nodeLibraryTab ??= new NodeLibrarySidebarTab(this.page)
    return this._nodeLibraryTab
  }

  get nodeLibraryTabV2() {
    this._nodeLibraryTabV2 ??= new NodeLibrarySidebarTabV2(this.page)
    return this._nodeLibraryTabV2
  }

  get appsTab() {
    this._appsTab ??= new SidebarTab(this.page, 'apps')
    return this._appsTab
  }

  get jobHistoryTab() {
    this._jobHistoryTab ??= new SidebarTab(this.page, 'job-history')
    return this._jobHistoryTab
  }

  get assetsTab() {
    this._assetsTab ??= new AssetsSidebarTab(this.page)
    return this._assetsTab
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
    const currentTheme = await this.getThemeId()
    await this.modeToggleButton.click()
    await this.page.waitForFunction(
      (prevTheme) => {
        const settings = window.app?.ui.settings
        return (
          settings &&
          settings.getSettingValue('Comfy.ColorPalette') !== prevTheme
        )
      },
      currentTheme,
      { timeout: 5000 }
    )
  }

  async getThemeId() {
    return await this.page.evaluate(async () => {
      return await window.app!.ui.settings.getSettingValue('Comfy.ColorPalette')
    })
  }
}
