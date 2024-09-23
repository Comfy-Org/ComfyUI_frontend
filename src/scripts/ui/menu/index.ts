import type { ComfyApp } from '@/scripts/app'
import { api } from '../../api'
import { $el } from '../../ui'
import { downloadBlob } from '../../utils'
import { ComfyButton } from '../components/button'
import { ComfyButtonGroup } from '../components/buttonGroup'
import { ComfySplitButton } from '../components/splitButton'
import { ComfyQueueButton } from './queueButton'
import { getInterruptButton } from './interruptButton'
import './menu.css'

const collapseOnMobile = (t) => {
  ;(t.element ?? t).classList.add('comfyui-menu-mobile-collapse')
  return t
}
const showOnMobile = (t) => {
  ;(t.element ?? t).classList.add('lt-lg-show')
  return t
}

export class ComfyAppMenu {
  app: ComfyApp
  logo: HTMLElement
  saveButton: ComfySplitButton
  actionsGroup: ComfyButtonGroup
  settingsGroup: ComfyButtonGroup
  viewGroup: ComfyButtonGroup
  mobileMenuButton: ComfyButton
  queueButton: ComfyQueueButton
  element: HTMLElement

  constructor(app: ComfyApp) {
    this.app = app
    const getSaveButton = (t?: string) =>
      new ComfyButton({
        icon: 'content-save',
        tooltip: 'Save the current workflow',
        action: () => app.workflowManager.activeWorkflow.save(),
        content: t
      })

    this.logo = $el('h1.comfyui-logo.nlg-hide', { title: 'ComfyUI' }, 'ComfyUI')
    this.saveButton = new ComfySplitButton(
      {
        primary: getSaveButton(),
        mode: 'hover',
        position: 'absolute'
      },
      getSaveButton('Save'),
      new ComfyButton({
        icon: 'content-save-edit',
        content: 'Save As',
        tooltip: 'Save the current graph as a new workflow',
        action: () => app.workflowManager.activeWorkflow.save(true)
      }),
      new ComfyButton({
        icon: 'download',
        content: 'Export',
        tooltip: 'Export the current workflow as JSON',
        action: () => this.exportWorkflow('workflow', 'workflow')
      }),
      new ComfyButton({
        icon: 'api',
        content: 'Export (API Format)',
        tooltip:
          'Export the current workflow as JSON for use with the ComfyUI API',
        action: () => this.exportWorkflow('workflow_api', 'output'),
        visibilitySetting: { id: 'Comfy.DevMode', showValue: true },
        app
      })
    )

    const actionButtons = [
      new ComfyButton({
        icon: 'refresh',
        content: 'Refresh',
        tooltip: 'Refresh widgets in nodes to find new models or files',
        action: () => app.refreshComboInNodes()
      }),
      new ComfyButton({
        icon: 'clipboard-edit-outline',
        content: 'Clipspace',
        tooltip: 'Open Clipspace window',
        action: () => app['openClipspace']()
      }),
      new ComfyButton({
        icon: 'fit-to-page-outline',
        content: 'Reset View',
        tooltip: 'Reset the canvas view',
        action: () => app.resetView()
      }),
      new ComfyButton({
        icon: 'cancel',
        content: 'Clear',
        tooltip: 'Clears current workflow',
        action: () => {
          if (
            !app.ui.settings.getSettingValue('Comfy.ConfirmClear', true) ||
            confirm('Clear workflow?')
          ) {
            app.clean()
            app.graph.clear()
            api.dispatchEvent(new CustomEvent('graphCleared'))
          }
        }
      })
    ]
    this.actionsGroup = new ComfyButtonGroup(...actionButtons)

    // Keep the settings group as there are custom scripts attaching extra
    // elements to it.
    this.settingsGroup = new ComfyButtonGroup()
    const interruptButton = getInterruptButton('nlg-hide').element
    this.viewGroup = new ComfyButtonGroup(interruptButton)
    this.mobileMenuButton = new ComfyButton({
      icon: 'menu',
      action: (_, btn) => {
        btn.icon = this.element.classList.toggle('expanded')
          ? 'menu-open'
          : 'menu'
        window.dispatchEvent(new Event('resize'))
      },
      classList: 'comfyui-button comfyui-menu-button'
    })
    this.queueButton = new ComfyQueueButton(app)

    this.element = $el('nav.comfyui-menu.lg', { style: { display: 'none' } }, [
      this.logo,
      this.saveButton.element,
      collapseOnMobile(this.actionsGroup).element,
      $el('section.comfyui-menu-push'),
      collapseOnMobile(this.settingsGroup).element,
      collapseOnMobile(this.viewGroup).element,

      getInterruptButton('lt-lg-show').element,
      this.queueButton.element,
      showOnMobile(this.mobileMenuButton).element
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
