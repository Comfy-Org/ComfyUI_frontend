import type { ComfyApp } from '@/scripts/app'
import { api } from '../../api'
import { $el } from '../../ui'
import { downloadBlob } from '../../utils'
import { ComfyButton } from '../components/button'
import { ComfyButtonGroup } from '../components/buttonGroup'
import { ComfySplitButton } from '../components/splitButton'
import { ComfyQueueButton } from './queueButton'
import { ComfyWorkflowsMenu } from './workflows'
import { getInterruptButton } from './interruptButton'
import './menu.css'
import type { ComfySettingsDialog } from '../settings'

type MenuPosition = 'Disabled' | 'Top' | 'Bottom' | 'Floating'

const collapseOnMobile = (t) => {
  ;(t.element ?? t).classList.add('comfyui-menu-mobile-collapse')
  return t
}
const showOnMobile = (t) => {
  ;(t.element ?? t).classList.add('lt-lg-show')
  return t
}

export class ComfyAppMenu {
  #sizeBreak = 'lg'
  #lastSizeBreaks = {
    lg: null,
    md: null,
    sm: null,
    xs: null
  }
  #sizeBreaks = Object.keys(this.#lastSizeBreaks)
  #cachedInnerSize = null
  #cacheTimeout = null
  app: ComfyApp
  workflows: ComfyWorkflowsMenu
  logo: HTMLElement
  saveButton: ComfySplitButton
  actionsGroup: ComfyButtonGroup
  settingsGroup: ComfyButtonGroup
  viewGroup: ComfyButtonGroup
  mobileMenuButton: ComfyButton
  queueButton: ComfyQueueButton
  element: HTMLElement
  menuPositionSetting: ReturnType<ComfySettingsDialog['addSetting']>
  position: MenuPosition

  constructor(app: ComfyApp) {
    this.app = app

    this.workflows = new ComfyWorkflowsMenu(app)
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
      this.workflows.element,
      this.saveButton.element,
      collapseOnMobile(this.actionsGroup).element,
      $el('section.comfyui-menu-push'),
      collapseOnMobile(this.settingsGroup).element,
      collapseOnMobile(this.viewGroup).element,

      getInterruptButton('lt-lg-show').element,
      this.queueButton.element,
      showOnMobile(this.mobileMenuButton).element
    ])

    let resizeHandler: () => void
    this.menuPositionSetting = app.ui.settings.addSetting({
      id: 'Comfy.UseNewMenu',
      category: ['Comfy', 'Menu', 'UseNewMenu'],
      defaultValue: 'Disabled',
      name: 'Use new menu and workflow management.',
      experimental: true,
      tooltip: 'On small screens the menu will always be at the top.',
      type: 'combo',
      options: ['Disabled', 'Floating', 'Top', 'Bottom'],
      onChange: async (v: MenuPosition) => {
        if (v && v !== 'Disabled') {
          const floating = v === 'Floating'
          if (floating) {
            if (resizeHandler) {
              window.removeEventListener('resize', resizeHandler)
              resizeHandler = null
            }
            this.element.classList.add('floating')
            document.body.classList.add('comfyui-floating-menu')
          } else {
            this.element.classList.remove('floating')
            document.body.classList.remove('comfyui-floating-menu')
            if (!resizeHandler) {
              resizeHandler = () => {
                this.calculateSizeBreak()
              }
              window.addEventListener('resize', resizeHandler)
            }
          }

          for (const b of [
            ...actionButtons.map((b) => b.element),
            interruptButton,
            this.queueButton.element
          ]) {
            b.style.display = floating ? 'none' : null
          }

          this.updatePosition(v)
        } else {
          if (resizeHandler) {
            window.removeEventListener('resize', resizeHandler)
            resizeHandler = null
          }
          document.body.style.removeProperty('display')
          if (app.ui.menuContainer) {
            app.ui.menuContainer.style.removeProperty('display')
          }
          this.element.style.display = 'none'
          app.ui.restoreMenuPosition()
        }
        window.dispatchEvent(new Event('resize'))
      }
    })
  }

  updatePosition(v: MenuPosition) {
    document.body.style.display = 'grid'
    if (this.app.ui.menuContainer) {
      this.app.ui.menuContainer.style.display = 'none'
    }
    this.element.style.removeProperty('display')
    this.position = v
    if (v === 'Bottom') {
      this.app.bodyBottom.append(this.element)
    } else {
      this.app.bodyTop.prepend(this.element)
    }
    if (v === 'Floating') {
      this.updateSizeBreak(0, this.#sizeBreaks.indexOf(this.#sizeBreak), -999)
    } else {
      this.calculateSizeBreak()
    }
  }

  updateSizeBreak(idx: number, prevIdx: number, direction: number) {
    const newSize = this.#sizeBreaks[idx]
    if (newSize === this.#sizeBreak) return
    this.#cachedInnerSize = null
    clearTimeout(this.#cacheTimeout)

    this.#sizeBreak = this.#sizeBreaks[idx]
    for (let i = 0; i < this.#sizeBreaks.length; i++) {
      const sz = this.#sizeBreaks[i]
      if (sz === this.#sizeBreak) {
        this.element.classList.add(sz)
      } else {
        this.element.classList.remove(sz)
      }
      if (i < idx) {
        this.element.classList.add('lt-' + sz)
      } else {
        this.element.classList.remove('lt-' + sz)
      }
    }

    if (idx) {
      // We're on a small screen, force the menu at the top
      if (this.position !== 'Top') {
        this.updatePosition('Top')
      }
    } else if (this.position != this.menuPositionSetting.value) {
      // Restore user position
      this.updatePosition(this.menuPositionSetting.value)
    }

    // Allow multiple updates, but prevent bouncing
    if (!direction) {
      direction = prevIdx - idx
    } else if (direction != prevIdx - idx) {
      return
    }
    this.calculateSizeBreak(direction)
  }

  calculateSizeBreak(direction = 0) {
    let idx = this.#sizeBreaks.indexOf(this.#sizeBreak)
    const currIdx = idx
    const innerSize = this.calculateInnerSize(idx)
    if (window.innerWidth >= this.#lastSizeBreaks[this.#sizeBreaks[idx - 1]]) {
      if (idx > 0) {
        idx--
      }
    } else if (innerSize > this.element.clientWidth) {
      this.#lastSizeBreaks[this.#sizeBreak] = Math.max(
        window.innerWidth,
        innerSize
      )
      // We need to shrink
      if (idx < this.#sizeBreaks.length - 1) {
        idx++
      }
    }

    this.updateSizeBreak(idx, currIdx, direction)
  }

  calculateInnerSize(idx: number) {
    // Cache the inner size to prevent too much calculation when resizing the window
    clearTimeout(this.#cacheTimeout)
    if (this.#cachedInnerSize) {
      // Extend cache time
      this.#cacheTimeout = setTimeout(() => (this.#cachedInnerSize = null), 100)
    } else {
      let innerSize = 0
      let count = 1
      for (const c of this.element.children) {
        if (c.classList.contains('comfyui-menu-push')) continue // ignore right push
        if (idx && c.classList.contains('comfyui-menu-mobile-collapse'))
          continue // ignore collapse items
        innerSize += c.clientWidth
        count++
      }
      innerSize += 8 * count
      this.#cachedInnerSize = innerSize
      this.#cacheTimeout = setTimeout(() => (this.#cachedInnerSize = null), 100)
    }
    return this.#cachedInnerSize
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
