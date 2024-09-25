import type { ComfyApp } from '@/scripts/app'
import { $el } from '../../ui'
import { downloadBlob } from '../../utils'
import { ComfyButtonGroup } from '../components/buttonGroup'
import './menu.css'

// Import ComfyButton to make sure it's shimmed and exported by vite
import { ComfyButton } from '../components/button'
import { ComfySplitButton } from '../components/splitButton'
import { ComfyPopup } from '../components/popup'
console.debug(
  `Keep following definitions ${ComfyButton} ${ComfySplitButton} ${ComfyPopup}`
)

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

  getFilename(defaultName: string) {
    if (this.app.ui.settings.getSettingValue('Comfy.PromptFilename', true)) {
      defaultName = prompt('Save workflow as:', defaultName)
      if (!defaultName) return
      if (!defaultName.toLowerCase().endsWith('.json')) {
        defaultName += '.json'
      }
    }
    return defaultName
  }

  async exportWorkflow(
    filename: string,
    promptProperty: 'workflow' | 'output'
  ) {
    if (this.app.workflowManager.activeWorkflow?.path) {
      filename = this.app.workflowManager.activeWorkflow.name
    }
    const p = await this.app.graphToPrompt()
    const json = JSON.stringify(p[promptProperty], null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const file = this.getFilename(filename)
    if (!file) return
    downloadBlob(file, blob)
  }
}
