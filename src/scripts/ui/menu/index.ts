import type { ComfyApp } from '@/scripts/app'
import { $el } from '../../ui'
import { downloadBlob } from '../../utils'
import { ComfyButtonGroup } from '../components/buttonGroup'
import { showPromptDialog } from '@/services/dialogService'
import { useSettingStore } from '@/stores/settingStore'
import './menu.css'

// Export to make sure following components are shimmed and exported by vite
export { ComfyButton } from '../components/button'
export { ComfySplitButton } from '../components/splitButton'
export { ComfyPopup } from '../components/popup'

export class ComfyAppMenu {
  app: ComfyApp
  actionsGroup: ComfyButtonGroup
  settingsGroup: ComfyButtonGroup
  viewGroup: ComfyButtonGroup
  element: HTMLElement

  constructor(app: ComfyApp) {
    this.app = app

    // Keep the group as there are custom scripts attaching extra
    // elements to it.
    this.actionsGroup = new ComfyButtonGroup()
    this.settingsGroup = new ComfyButtonGroup()
    this.viewGroup = new ComfyButtonGroup()

    this.element = $el('div.flex.gap-2.mx-2', [
      this.actionsGroup.element,
      this.settingsGroup.element,
      this.viewGroup.element
    ])
  }

  async getFilename(defaultName: string): Promise<string | null> {
    if (useSettingStore().get('Comfy.PromptFilename')) {
      let filename = await showPromptDialog('Save workflow as:', defaultName)
      if (!filename) return null
      if (!filename.toLowerCase().endsWith('.json')) {
        filename += '.json'
      }
      return filename
    }
    return defaultName
  }

  async exportWorkflow(
    filename: string,
    promptProperty: 'workflow' | 'output'
  ): Promise<void> {
    if (this.app.workflowManager.activeWorkflow?.path) {
      filename = this.app.workflowManager.activeWorkflow.name
    }
    const p = await this.app.graphToPrompt()
    const json = JSON.stringify(p[promptProperty], null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const file = await this.getFilename(filename)
    if (!file) return
    downloadBlob(file, blob)
  }
}
