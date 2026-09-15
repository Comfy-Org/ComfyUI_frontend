import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import { NodeTemplatesManageDialog } from '@e2e/fixtures/components/NodeTemplatesManageDialog'
import { DefaultGraphNewMenuPositions } from '@e2e/fixtures/constants/defaultGraphPositions'

export class NodeTemplatesHelper {
  public readonly manageDialog: NodeTemplatesManageDialog

  constructor(private readonly comfyPage: ComfyPage) {
    this.manageDialog = new NodeTemplatesManageDialog(comfyPage.page)
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

  async saveSelectionAsTemplate(name: string): Promise<void> {
    await this.openCanvasMenu()
    await this.comfyPage.contextMenu.clickLitegraphMenuItem(
      'Save Selected as Template'
    )
    await this.comfyPage.nodeOps.fillPromptDialog(name)
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
