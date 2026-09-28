import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { NodeTemplatesManageDialog } from '@e2e/fixtures/components/NodeTemplatesManageDialog'
import { DefaultGraphNewMenuPositions } from '@e2e/fixtures/constants/defaultGraphPositions'
import type { UserDataHelper } from '@e2e/fixtures/helpers/UserDataHelper'

const TEMPLATES_FILE = 'comfy.templates.json'

interface NodeTemplateFixture {
  name: string
  data: string
}

export class NodeTemplatesHelper {
  public readonly manageDialog: NodeTemplatesManageDialog
  private templateWriteCount = 0

  constructor(
    private readonly comfyPage: ComfyPage,
    private readonly userData: UserDataHelper
  ) {
    this.manageDialog = new NodeTemplatesManageDialog(comfyPage.page)
  }

  /**
   * Delete the per-user template store server-side.
   */
  async reset(): Promise<void> {
    await this.userData.delete(TEMPLATES_FILE)
  }

  async seedTemplates(templates: NodeTemplateFixture[]): Promise<void> {
    await this.userData.write(TEMPLATES_FILE, templates)
  }

  async readPersistedTemplates(): Promise<NodeTemplateFixture[]> {
    return await this.userData.read<NodeTemplateFixture[]>(TEMPLATES_FILE)
  }

  async mockUnreadableTemplateLoad(): Promise<void> {
    await this.comfyPage.page.route(
      `**/api/userdata/${TEMPLATES_FILE}**`,
      async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: '[{"name":'
          })
          return
        }

        this.templateWriteCount++
        await route.fallback()
      }
    )
  }

  async mockUnreadableTemplateLoadOnce(): Promise<void> {
    let hasFailed = false

    await this.comfyPage.page.route(
      `**/api/userdata/${TEMPLATES_FILE}**`,
      async (route) => {
        if (route.request().method() !== 'GET') {
          await route.fallback()
          return
        }

        if (!hasFailed) {
          hasFailed = true
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: '[{"name":'
          })
          return
        }

        await route.fallback()
      }
    )
  }

  waitForTemplatesLoad() {
    return this.comfyPage.page.waitForResponse(
      (res) =>
        res.request().method() === 'GET' &&
        res.url().includes(`/api/userdata/${TEMPLATES_FILE}`)
    )
  }

  async reloadAndWaitForTemplates(): Promise<void> {
    const templatesLoad = this.waitForTemplatesLoad()
    await this.comfyPage.workflow.reloadAndWaitForApp()
    await templatesLoad
    await this.comfyPage.nextFrame()
  }

  getTemplateWriteCount(): number {
    return this.templateWriteCount
  }

  private async openCanvasMenu(): Promise<void> {
    await this.comfyPage.canvasOps.mouseClickAt(
      DefaultGraphNewMenuPositions.emptyCanvasClick,
      { button: 'right' }
    )
  }

  private async openTemplateSubmenu(): Promise<void> {
    await this.openCanvasMenu()
    await this.comfyPage.contextMenu.clickLitegraphMenuItem('Node Templates')
  }

  async saveKSamplerAsTemplate(name: string): Promise<void> {
    const ksampler = (
      await this.comfyPage.nodeOps.getNodeRefsByType('KSampler')
    )[0]
    await ksampler.click('title')
    await this.saveSelectionAsTemplate(name)
  }

  async selectKSampler(): Promise<void> {
    const ksampler = await this.comfyPage.nodeOps.getNodeRefByType('KSampler')
    await this.comfyPage.page.evaluate((id) => {
      const node = window.app!.graph.getNodeById(id)
      if (!node) throw new Error(`Node ${id} not found`)
      window.app!.canvas.selectNode(node)
    }, ksampler.id)
  }

  async saveSelectionAsTemplate(name: string): Promise<void> {
    await this.openCanvasMenu()
    await this.comfyPage.contextMenu.clickLitegraphMenuItem(
      'Save Selected as Template'
    )
    await this.comfyPage.nodeOps.fillPromptDialog(name)
  }

  async expectSaveSelectionDisabled(): Promise<void> {
    await this.openCanvasMenu()
    const item = this.comfyPage.page
      .locator('.litemenu-entry.disabled', {
        hasText: 'Save Selected as Template'
      })
      .last()
    await item.waitFor({ state: 'visible' })
    if ((await item.getAttribute('aria-disabled')) !== 'true') {
      throw new Error('Save Selected as Template should be disabled')
    }
  }

  async insertTemplate(name: string): Promise<void> {
    await this.openTemplateSubmenu()
    await this.comfyPage.contextMenu.clickLitegraphMenuItem(name)
    await this.comfyPage.contextMenu.waitForHidden()
  }

  async openManageDialog(): Promise<void> {
    await this.openTemplateSubmenu()
    await this.comfyPage.contextMenu.clickLitegraphMenuItem('Manage')
    await this.manageDialog.waitForVisible()
  }
}
