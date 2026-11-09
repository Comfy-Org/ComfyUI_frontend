import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import { waitForCloudApp } from '@e2e/fixtures/cloudAppFixture'
import { AgentPanel } from '@e2e/fixtures/components/AgentPanel'
import { TestIds } from '@e2e/fixtures/selectors'

type Presentation = 'docked' | 'overlay' | 'fullscreen'

export class AgentFullscreen {
  public readonly panel: AgentPanel
  public readonly workspace: Locator
  public readonly canvas: Locator
  public readonly maximizeButton: Locator
  public readonly minimizeButton: Locator
  public readonly sidebar: Locator
  public readonly sidebarScrim: Locator
  public readonly openSidebarButton: Locator
  public readonly closeSidebarButton: Locator
  public readonly chatList: Locator
  public readonly chatRows: Locator
  public readonly pinnedHeading: Locator
  public readonly chatMenu: Locator
  public readonly confirmDeleteButton: Locator
  public readonly accountMenuButton: Locator
  public readonly accountMenu: Locator
  public readonly metaRow: Locator
  public readonly outputsToggle: Locator
  public readonly outputsTray: Locator
  public readonly starterPrompts: Locator
  public readonly topBar: Locator
  public readonly brand: Locator
  public readonly topBarBrand: Locator
  public readonly sidebarBrand: Locator
  public readonly chatTitleMenu: Locator
  public readonly resizeHandle: Locator
  public readonly sectionNav: Locator
  public readonly libraryRows: Locator
  public readonly templatesDialog: Locator
  public readonly brandWordmark: Locator

  constructor(private readonly page: Page) {
    this.panel = new AgentPanel(page)
    this.workspace = page.locator('.comfyui-body')
    this.canvas = page.locator('#graph-canvas')
    this.maximizeButton = this.panel.root.getByRole('button', {
      name: enMessages.agent.maximize,
      exact: true
    })
    this.minimizeButton = this.panel.root.getByRole('button', {
      name: enMessages.agent.minimize,
      exact: true
    })
    this.sidebar = page.getByTestId(TestIds.agent.sidebar)
    this.sidebarScrim = page.getByTestId(TestIds.agent.sidebarScrim)
    this.openSidebarButton = this.sidebar.getByRole('button', {
      name: enMessages.agent.sidebar.open,
      exact: true
    })
    this.closeSidebarButton = this.sidebar.getByRole('button', {
      name: enMessages.agent.sidebar.close,
      exact: true
    })
    this.chatList = this.sidebar.getByRole('navigation', {
      name: enMessages.agent.sidebar.chats
    })
    this.chatRows = this.sidebar.getByTestId(TestIds.agent.chatRow)
    this.pinnedHeading = this.chatList.getByText(
      enMessages.agent.sidebar.pinned,
      { exact: true }
    )
    this.chatMenu = page.getByRole('menu')
    this.confirmDeleteButton = page
      .getByRole('dialog')
      .getByRole('button', { name: enMessages.g.delete })
    this.accountMenuButton = this.sidebar.getByRole('button', {
      name: enMessages.agent.account.menu,
      exact: true
    })
    this.accountMenu = page.getByRole('menu')
    this.metaRow = this.panel.root.getByRole('group', {
      name: enMessages.agent.chatSettings
    })
    this.outputsToggle = this.metaRow.getByRole('button', {
      name: enMessages.agent.outputs.toggle,
      exact: true
    })
    this.outputsTray = this.panel.root.getByRole('region', {
      name: enMessages.agent.outputs.title
    })
    this.starterPrompts = this.panel.root.getByTestId(
      TestIds.agent.starterPrompts
    )
    this.topBar = this.panel.root.locator('header')
    const brandHeading = { name: enMessages.agent.title, exact: true }
    this.brand = page.getByRole('heading', brandHeading)
    this.topBarBrand = this.topBar.getByRole('heading', brandHeading)
    this.sidebarBrand = this.sidebar.getByRole('heading', brandHeading)
    this.chatTitleMenu = this.panel.root.getByRole('group', {
      name: enMessages.agent.chatOptions
    })
    this.resizeHandle = this.sidebar.getByRole('separator', {
      name: enMessages.agent.sidebar.resize,
      exact: true
    })
    this.sectionNav = this.sidebar.getByRole('navigation', {
      name: enMessages.agent.nav.label
    })
    this.libraryRows = this.sidebar
      .getByRole('navigation', {
        name: new RegExp(
          `^(${enMessages.agent.nav.apps}|${enMessages.agent.nav.workflows})$`
        )
      })
      .getByRole('listitem')
    this.templatesDialog = page
      .getByRole('dialog')
      .filter({ has: page.getByTestId('template-workflows-content') })
    this.brandWordmark = this.brand.getByRole('img', {
      name: enMessages.agent.brandWordmarkAlt,
      exact: true
    })
  }

  sectionButton(name: string): Locator {
    return this.sectionNav.getByRole('button', { name, exact: true })
  }

  workspaceOption(name: string): Locator {
    return this.accountMenu.getByRole('menuitemradio', {
      name: new RegExp(`^${name}`)
    })
  }

  accountMenuItem(name: string): Locator {
    return this.accountMenu.getByRole('menuitem', {
      name: new RegExp(`^${name}`)
    })
  }

  async sidebarWidth(): Promise<number | undefined> {
    return (await this.sidebar.boundingBox())?.width
  }

  async dragSidebarEdgeBy(deltaX: number): Promise<void> {
    const handle = await this.resizeHandle.boundingBox()
    if (!handle) throw new Error('The sidebar resize handle is not visible')
    const x = handle.x + handle.width / 2
    const y = handle.y + handle.height / 2
    await this.page.mouse.move(x, y)
    await this.page.mouse.down()
    await this.page.mouse.move(x + deltaX / 2, y)
    await this.page.mouse.move(x + deltaX, y)
    await this.page.mouse.up()
  }

  async composerBottomGap(): Promise<number | null> {
    const panel = await this.panel.dockedPanel.boundingBox()
    const composer = await this.metaRow.boundingBox()
    if (!panel || !composer) return null
    return Math.round(panel.y + panel.height - (composer.y + composer.height))
  }

  chatRow(title: string): Locator {
    return this.chatRows.filter({
      has: this.page.getByRole('button', { name: title })
    })
  }

  outputTile(name: string): Locator {
    return this.outputsTray.getByRole('button', {
      name: enMessages.agent.outputs.select.replace('{name}', name),
      exact: true
    })
  }

  async expectPresentation(presentation: Presentation): Promise<void> {
    await expect(this.panel.dockedPanel).toHaveAttribute(
      'data-presentation',
      presentation
    )
  }

  async enter(): Promise<void> {
    await this.maximizeButton.click()
    await this.expectPresentation('fullscreen')
  }

  async exit(): Promise<void> {
    await this.minimizeButton.click()
    await this.expectPresentation('docked')
  }

  async openChatMenu(title: string): Promise<void> {
    await this.chatRow(title)
      .getByRole('button', { name: enMessages.agent.chatOptions, exact: true })
      .click()
    await expect(this.chatMenu).toBeVisible()
  }

  async chooseChatAction(title: string, action: string): Promise<void> {
    await this.openChatMenu(title)
    await this.chatMenu
      .getByRole('menuitem', { name: action, exact: true })
      .click()
  }

  async toggleByCommand(): Promise<void> {
    await this.page.evaluate(() =>
      window.app!.extensionManager.command.execute(
        'Comfy.Agent.ToggleFullScreen'
      )
    )
  }

  async reload(): Promise<void> {
    await this.page.reload()
    await waitForCloudApp(this.page)
  }
}
