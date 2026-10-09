import { effectScope, watch } from 'vue'

import { useRunButtonTelemetry } from '@/composables/useRunButtonTelemetry'
import * as i18nModule from '@/i18n'
import type { StatusWsMessageStatus } from '@/platform/remote/comfyui/execution/types'
import { extractWorkflow } from '@/platform/remote/comfyui/jobs/fetchJobs'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useTelemetry } from '@/platform/telemetry'
import { WORKFLOW_ACCEPT_STRING } from '@/platform/workflow/core/types/formats'
import { useLitegraphService } from '@/services/litegraphService'
import { useCommandStore } from '@/stores/commandStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'

import { api } from './api'
import type { ComfyApp } from './app'
import { app } from './app'
import { ComfyDialog as _ComfyDialog } from './ui/dialog'
import { $el as _$el } from './ui/utils'
import { ComfySettingsDialog } from './ui/settings'
import { toggleSwitch } from './ui/toggleSwitch'

export const ComfyDialog = _ComfyDialog
export const $el = _$el

type Position2D = {
  x: number
  y: number
}

function dragElement(dragEl: HTMLElement): () => void {
  let posDiffX = 0,
    posDiffY = 0,
    posStartX = 0,
    posStartY = 0,
    newPosX = 0,
    newPosY = 0
  const dragHandle = dragEl.querySelector<HTMLElement>('.drag-handle')
  if (dragHandle) {
    // if present, the handle is where you move the DIV from:
    dragHandle.onmousedown = dragMouseDown
  } else {
    // otherwise, move the DIV from anywhere inside the DIV:
    dragEl.onmousedown = dragMouseDown
  }

  // When the element resizes (e.g. view queue) ensure it is still in the windows bounds
  new ResizeObserver(() => {
    ensureInBounds()
  }).observe(dragEl)

  function ensureInBounds() {
    try {
      newPosX = Math.min(
        document.body.clientWidth - dragEl.clientWidth,
        Math.max(0, dragEl.offsetLeft)
      )
      newPosY = Math.min(
        document.body.clientHeight - dragEl.clientHeight,
        Math.max(0, dragEl.offsetTop)
      )

      positionElement()
    } catch {
      // robust
    }
  }

  function positionElement() {
    if (dragEl.style.display === 'none') return

    const halfWidth = document.body.clientWidth / 2
    const anchorRight = newPosX + dragEl.clientWidth / 2 > halfWidth

    // set the element's new position:
    if (anchorRight) {
      dragEl.style.left = 'unset'
      dragEl.style.right =
        document.body.clientWidth - newPosX - dragEl.clientWidth + 'px'
    } else {
      dragEl.style.left = newPosX + 'px'
      dragEl.style.right = 'unset'
    }

    dragEl.style.top = newPosY + 'px'
    dragEl.style.bottom = 'unset'

    if (savePos) {
      try {
        localStorage.setItem(
          'Comfy.MenuPosition',
          JSON.stringify({
            x: dragEl.offsetLeft,
            y: dragEl.offsetTop
          })
        )
      } catch {
        // Persisting the menu position is cosmetic; storage can be unavailable
        // (private browsing, quota exceeded). Never let it break dragging.
      }
    }
  }

  function restorePos() {
    // `dragElement` is reached from ComfyUI's constructor, which runs at module
    // scope via `export const app = new ComfyApp()` in app.ts. A throw here
    // therefore breaks *importing* that module, not just the menu. Restoring a
    // remembered position is cosmetic, so degrade quietly instead: localStorage
    // may be absent or degraded outside a real browser (e.g. Node >= 25 without
    // `--no-experimental-webstorage`), and the stored value may be corrupt.
    let pos: Position2D
    try {
      const posString = localStorage.getItem('Comfy.MenuPosition')
      if (!posString) return
      pos = JSON.parse(posString) as Position2D
    } catch {
      return
    }

    newPosX = pos.x
    newPosY = pos.y
    positionElement()
    ensureInBounds()
  }

  let savePos = false
  restorePos()
  savePos = true

  function dragMouseDown(e: MouseEvent) {
    e.preventDefault()
    // get the mouse cursor position at startup:
    posStartX = e.clientX
    posStartY = e.clientY
    document.onmouseup = closeDragElement
    // call a function whenever the cursor moves:
    document.onmousemove = elementDrag
  }

  function elementDrag(e: MouseEvent) {
    e.preventDefault()

    dragEl.classList.add('comfy-menu-manual-pos')

    // calculate the new cursor position:
    posDiffX = e.clientX - posStartX
    posDiffY = e.clientY - posStartY
    posStartX = e.clientX
    posStartY = e.clientY

    newPosX = Math.min(
      document.body.clientWidth - dragEl.clientWidth,
      Math.max(0, dragEl.offsetLeft + posDiffX)
    )
    newPosY = Math.min(
      document.body.clientHeight - dragEl.clientHeight,
      Math.max(0, dragEl.offsetTop + posDiffY)
    )

    positionElement()
  }

  window.addEventListener('resize', () => {
    ensureInBounds()
  })

  function closeDragElement() {
    // stop moving when mouse button is released:
    document.onmouseup = null
    document.onmousemove = null
  }

  return restorePos
}

function setControlLabel(element: Element, label: string) {
  const textNode = [...element.childNodes].find(
    (node) => node.nodeType === Node.TEXT_NODE
  )
  if (textNode) {
    textNode.nodeValue = label
    return
  }
  element.prepend(label)
}

function legacyMenuText(
  key: string,
  values?: Record<string, string | number>
): string {
  const moduleExports: object = i18nModule
  if (!('t' in moduleExports)) return key
  const translate = Reflect.get(moduleExports, 't')
  if (typeof translate !== 'function') return key
  const translated: unknown = values ? translate(key, values) : translate(key)
  return typeof translated === 'string' ? translated : key
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function legacyMenuLocaleMessages() {
  const moduleExports: object = i18nModule
  const exported =
    'i18n' in moduleExports
      ? asRecord(Reflect.get(moduleExports, 'i18n'))
      : undefined
  const composer =
    exported && 'global' in exported ? asRecord(exported.global) : undefined
  const getLocaleMessage = composer?.getLocaleMessage
  const localeValue = asRecord(composer?.locale)?.value
  if (
    typeof getLocaleMessage !== 'function' ||
    typeof localeValue !== 'string'
  ) {
    return
  }
  return getLocaleMessage(localeValue)
}

function legacyMenuSectionLabel(section: string): string {
  switch (section) {
    case 'Running':
      return legacyMenuText('legacyMenu.running')
    case 'Pending':
      return legacyMenuText('legacyMenu.pending')
    case 'history':
      return legacyMenuText('legacyMenu.historySection')
    default:
      return section
  }
}

class ComfyList {
  private readonly list: 'queue' | 'history'
  private readonly _reverse: boolean
  private lastSections: Record<string, JobListItem[]> | null = null
  element: HTMLDivElement
  button?: HTMLButtonElement

  constructor(list: 'queue' | 'history', reverse = false) {
    this.list = list
    this._reverse = reverse
    this.element = $el('div.comfy-list') as HTMLDivElement
    this.element.style.display = 'none'

    console.warn(
      '[ComfyUI] The legacy queue/history menu is deprecated. ' +
        'Core functionality in this menu may break at any time. ' +
        'Issues and feature requests related to the legacy menu will not be addressed. ' +
        'To switch to the new menu: Settings → search "Use new menu" → change from "Disabled" to "Top".'
    )
  }

  private get listLabel() {
    return this.list === 'queue'
      ? legacyMenuText('legacyMenu.queue')
      : legacyMenuText('legacyMenu.history')
  }

  get visible() {
    return this.element.style.display !== 'none'
  }

  private render(sections: Record<string, JobListItem[]>) {
    this.element.replaceChildren(
      ...Object.entries(sections).flatMap(([section, sectionItems]) => [
        $el('h4', {
          textContent: legacyMenuSectionLabel(section)
        }),
        $el(
          'div.comfy-list-items',
          (this._reverse ? [...sectionItems].reverse() : sectionItems).map(
            (item) => {
              const removeAction =
                section === 'Running'
                  ? {
                      name: legacyMenuText('legacyMenu.cancel'),
                      cb: () => api.interrupt(item.id)
                    }
                  : {
                      name: legacyMenuText('legacyMenu.delete'),
                      cb: () => api.deleteItem(this.list, item.id)
                    }
              return $el('div', { textContent: item.priority + ': ' }, [
                $el('button', {
                  textContent: legacyMenuText('legacyMenu.load'),
                  onclick: async () => {
                    const job = await api.getJobDetail(item.id)
                    if (!job) return
                    const workflow = await extractWorkflow(job)
                    await app.loadGraphData(workflow, true, false)
                    if ('outputs' in job && job.outputs) {
                      useNodeOutputStore().restoreOutputs(job.outputs)
                    }
                  }
                }),
                $el('button', {
                  textContent: removeAction.name,
                  onclick: async () => {
                    await removeAction.cb()
                    await this.update()
                  }
                })
              ])
            }
          )
        )
      ]),
      $el('div.comfy-list-actions', [
        $el('button', {
          textContent: legacyMenuText('legacyMenu.clearList', {
            name: this.listLabel
          }),
          onclick: async () => {
            await api.clearItems(this.list)
            await this.load()
          }
        }),
        $el('button', {
          textContent: legacyMenuText('legacyMenu.refresh'),
          onclick: () => this.load()
        })
      ])
    )
  }

  async load() {
    const sections: Record<string, JobListItem[]> = {}
    if (this.list === 'history') {
      sections.history = await api.getHistory()
    } else {
      const queue = await api.getQueue()
      sections.Running = queue.Running
      sections.Pending = queue.Pending
    }
    this.lastSections = sections
    this.render(sections)
  }

  async update() {
    if (this.visible) {
      await this.load()
    }
  }

  async show() {
    this.element.style.display = 'block'
    if (this.button)
      this.button.textContent = legacyMenuText('legacyMenu.close')

    await this.load()
  }

  hide() {
    this.element.style.display = 'none'
    if (this.button) {
      this.button.textContent = legacyMenuText('legacyMenu.viewList', {
        name: this.listLabel
      })
    }
  }

  applyLocalizedChrome() {
    if (this.button) {
      this.button.textContent = this.visible
        ? legacyMenuText('legacyMenu.close')
        : legacyMenuText('legacyMenu.viewList', { name: this.listLabel })
    }
    if (this.visible && this.lastSections) this.render(this.lastSections)
  }

  toggle() {
    if (this.visible) {
      this.hide()
      return false
    } else {
      void this.show()
      return true
    }
  }
}

export class ComfyUI {
  app: ComfyApp
  dialog: _ComfyDialog
  settings: ComfySettingsDialog
  batchCount: number
  lastQueueSize: number
  queue: ComfyList
  history: ComfyList
  autoQueueMode = ''
  graphHasChanged = false
  autoQueueEnabled = false
  menuContainer = document.createElement('div')
  queueSize: Element = document.createElement('span')
  private displayedQueueRemaining: number | null = null
  private applyLocalizedText: () => void = () => {}
  restoreMenuPosition = () => {}
  loadFile = () => {}

  constructor(app: ComfyApp) {
    this.app = app
    this.dialog = new ComfyDialog()
    this.settings = new ComfySettingsDialog(app)

    this.batchCount = 1
    this.lastQueueSize = 0
    this.queue = new ComfyList('queue')
    this.history = new ComfyList('history', true)

    api.addEventListener('status', () => {
      void this.queue.update()
      void this.history.update()
    })

    this.setup(document.body)
  }

  setup(containerElement: HTMLElement) {
    const fileInput = $el('input', {
      id: 'comfy-file-input',
      type: 'file',
      accept: WORKFLOW_ACCEPT_STRING,
      style: { display: 'none' },
      parent: document.body,
      onchange: async () => {
        const file = fileInput.files?.[0]
        if (file) {
          try {
            await app.handleFile(file, 'file_button')
          } catch (error) {
            console.error('Failed to load file:', error)
            app.showErrorOnFileLoad(file)
          } finally {
            fileInput.value = ''
          }
        }
      }
    })

    this.loadFile = () => fileInput.click()

    const autoQueueModeEl = toggleSwitch(
      'autoQueueMode',
      [
        {
          text: legacyMenuText('legacyMenu.instant'),
          value: 'instant',
          tooltip: legacyMenuText('legacyMenu.instantTooltip')
        },
        {
          text: legacyMenuText('legacyMenu.change'),
          value: 'change',
          tooltip: legacyMenuText('legacyMenu.changeTooltip')
        }
      ],
      {
        onChange: (value) => {
          this.autoQueueMode = value.item.value
        }
      }
    )
    autoQueueModeEl.style.display = 'none'

    api.addEventListener('autoQueueGraphChanged', () => {
      if (this.autoQueueMode === 'change' && this.autoQueueEnabled) {
        if (this.lastQueueSize === 0) {
          this.graphHasChanged = false
          void app.queuePrompt(0, this.batchCount, {
            intent: { trigger_source: 'auto_queue' }
          })
        } else {
          this.graphHasChanged = true
        }
      }
    })

    let extraOptionsLabel: HTMLElement | undefined
    let batchCountLabel: HTMLElement | undefined
    let autoQueueLabel: HTMLElement | undefined
    let autoQueueInput: HTMLElement | undefined

    this.menuContainer = $el(
      'div.comfy-menu.no-drag',
      { parent: containerElement },
      [
        $el(
          'div.drag-handle.comfy-menu-header',
          {
            style: {
              overflow: 'hidden',
              position: 'relative',
              width: '100%',
              cursor: 'default'
            }
          },
          [
            $el('span.drag-handle'),
            $el('span.comfy-menu-queue-size', {
              $: (q) => (this.queueSize = q)
            }),
            $el('div.comfy-menu-actions', [
              $el('button.comfy-settings-btn', {
                textContent: '⚙️',
                onclick: () => {
                  useSettingsDialog().show()
                }
              }),
              $el('button.comfy-close-menu-btn', {
                textContent: '\u00d7',
                onclick: () => {
                  useWorkspaceStore().focusMode = true
                }
              })
            ])
          ]
        ),
        $el('button.comfy-queue-btn', {
          id: 'queue-button',
          onclick: () => {
            const workflowQueueIntent = {
              trigger_source: 'legacy_ui'
            } as const
            useRunButtonTelemetry().trackRunButton(workflowQueueIntent)
            useTelemetry()?.trackWorkflowExecution()
            void app.queuePrompt(0, this.batchCount, {
              intent: workflowQueueIntent
            })
          }
        }),
        $el('div', {}, [
          $el('label', { $: (el) => (extraOptionsLabel = el) }, [
            $el('input', {
              type: 'checkbox',
              onchange: (event: Event) => {
                const input = event.currentTarget
                const extraOptions = document.getElementById('extraOptions')
                if (!(input instanceof HTMLInputElement) || !extraOptions)
                  return
                extraOptions.style.display = input.checked ? 'block' : 'none'
                this.batchCount = input.checked
                  ? Number.parseInt(
                      (
                        document.getElementById(
                          'batchCountInputRange'
                        ) as HTMLInputElement
                      ).value
                    )
                  : 1
                ;(
                  document.getElementById(
                    'autoQueueCheckbox'
                  ) as HTMLInputElement
                ).checked = false
                this.autoQueueEnabled = false
              }
            })
          ])
        ]),
        $el(
          'div',
          { id: 'extraOptions', style: { width: '100%', display: 'none' } },
          [
            $el('div', [
              $el('label', { $: (el) => (batchCountLabel = el) }),
              $el('input', {
                id: 'batchCountInputNumber',
                type: 'number',
                value: this.batchCount,
                min: '1',
                style: { width: '35%', marginLeft: '0.4em' },
                oninput: (event: Event) => {
                  const input = event.currentTarget
                  if (!(input instanceof HTMLInputElement)) return
                  this.batchCount = Number(input.value)
                  /* Even though an <input> element with a type of range logically represents a number (since
              it's used for numeric input), the value it holds is still treated as a string in HTML and
              JavaScript. This behavior is consistent across all <input> elements regardless of their type
              (like text, number, or range), where the .value property is always a string. */
                  ;(
                    document.getElementById(
                      'batchCountInputRange'
                    ) as HTMLInputElement
                  ).value = this.batchCount.toString()
                }
              }),
              $el('input', {
                id: 'batchCountInputRange',
                type: 'range',
                min: '1',
                max: '100',
                value: this.batchCount,
                oninput: (event: Event) => {
                  const input = event.currentTarget
                  if (!(input instanceof HTMLInputElement)) return
                  this.batchCount = Number(input.value)
                  // Note
                  ;(
                    document.getElementById(
                      'batchCountInputNumber'
                    ) as HTMLInputElement
                  ).value = input.value
                }
              })
            ]),
            $el('div', [
              $el('label', {
                for: 'autoQueueCheckbox',
                $: (el) => (autoQueueLabel = el)
              }),
              $el('input', {
                id: 'autoQueueCheckbox',
                type: 'checkbox',
                checked: false,
                $: (el) => (autoQueueInput = el),
                onchange: (event: Event) => {
                  const input = event.currentTarget
                  if (!(input instanceof HTMLInputElement)) return
                  this.autoQueueEnabled = input.checked
                  autoQueueModeEl.style.display = this.autoQueueEnabled
                    ? ''
                    : 'none'
                }
              }),
              autoQueueModeEl
            ])
          ]
        ),
        $el('div.comfy-menu-btns', [
          $el('button', {
            id: 'queue-front-button',
            onclick: () => {
              const workflowQueueIntent = {
                trigger_source: 'legacy_ui'
              } as const
              useRunButtonTelemetry().trackRunButton(workflowQueueIntent)
              useTelemetry()?.trackWorkflowExecution()
              void app.queuePrompt(-1, this.batchCount, {
                intent: workflowQueueIntent
              })
            }
          }),
          $el('button', {
            $: (b) => (this.queue.button = b as HTMLButtonElement),
            id: 'comfy-view-queue-button',
            onclick: () => {
              this.history.hide()
              this.queue.toggle()
            }
          }),
          $el('button', {
            $: (b) => (this.history.button = b as HTMLButtonElement),
            id: 'comfy-view-history-button',
            onclick: () => {
              this.queue.hide()
              this.history.toggle()
            }
          })
        ]),
        this.queue.element,
        this.history.element,
        $el('button', {
          id: 'comfy-save-button',
          onclick: () => {
            void useCommandStore().execute('Comfy.ExportWorkflow')
          }
        }),
        $el('button', {
          id: 'comfy-dev-save-api-button',
          style: { width: '100%', display: 'none' },
          onclick: () => {
            void useCommandStore().execute('Comfy.ExportWorkflowAPI')
          }
        }),
        $el('button', {
          id: 'comfy-load-button',
          onclick: () => fileInput.click()
        }),
        $el('button', {
          id: 'comfy-refresh-button',
          onclick: () => {
            void app.refreshComboInNodes().catch(() => {})
          }
        }),
        $el('button', {
          id: 'comfy-clipspace-button',
          onclick: () => app.openClipspace()
        }),
        $el('button', {
          id: 'comfy-clear-button',
          onclick: () => {
            if (
              !useSettingStore().get('Comfy.ConfirmClear') ||
              confirm(legacyMenuText('legacyMenu.confirmClear'))
            ) {
              app.clean()
              useLitegraphService().resetView()
              api.dispatchCustomEvent('graphCleared')
            }
          }
        }),
        $el('button', {
          id: 'comfy-load-default-button',
          onclick: async () => {
            if (
              !useSettingStore().get('Comfy.ConfirmClear') ||
              confirm(legacyMenuText('legacyMenu.confirmLoadDefault'))
            ) {
              useLitegraphService().resetView()
              await app.loadGraphData()
            }
          }
        }),
        $el('button', {
          id: 'comfy-reset-view-button',
          onclick: async () => {
            useLitegraphService().resetView()
          }
        })
      ]
    ) as HTMLDivElement
    // Hide by default on construction so it does not interfere with other views.
    this.menuContainer.style.display = 'none'

    this.restoreMenuPosition = dragElement(this.menuContainer)

    this.applyLocalizedText = () => {
      if (extraOptionsLabel) {
        setControlLabel(
          extraOptionsLabel,
          legacyMenuText('legacyMenu.extraOptions')
        )
      }
      if (batchCountLabel) {
        setControlLabel(
          batchCountLabel,
          legacyMenuText('legacyMenu.batchCount')
        )
      }
      if (autoQueueLabel) {
        setControlLabel(autoQueueLabel, legacyMenuText('legacyMenu.autoQueue'))
      }
      if (autoQueueInput) {
        autoQueueInput.title = legacyMenuText('legacyMenu.autoQueueTooltip')
      }

      const modeLabels = [...autoQueueModeEl.querySelectorAll('label')]
      const modes = [
        {
          text: legacyMenuText('legacyMenu.instant'),
          tooltip: legacyMenuText('legacyMenu.instantTooltip')
        },
        {
          text: legacyMenuText('legacyMenu.change'),
          tooltip: legacyMenuText('legacyMenu.changeTooltip')
        }
      ]
      for (const [index, mode] of modes.entries()) {
        const label = modeLabels[index]
        setControlLabel(label, mode.text)
        label.title = mode.tooltip
      }

      const controls = [
        ['#queue-button', legacyMenuText('legacyMenu.queuePrompt')],
        ['#queue-front-button', legacyMenuText('legacyMenu.queueFront')],
        ['#comfy-save-button', legacyMenuText('legacyMenu.save')],
        [
          '#comfy-dev-save-api-button',
          legacyMenuText('legacyMenu.saveApiFormat')
        ],
        ['#comfy-load-button', legacyMenuText('legacyMenu.load')],
        ['#comfy-refresh-button', legacyMenuText('legacyMenu.refresh')],
        ['#comfy-clipspace-button', legacyMenuText('legacyMenu.clipspace')],
        ['#comfy-clear-button', legacyMenuText('legacyMenu.clear')],
        [
          '#comfy-load-default-button',
          legacyMenuText('legacyMenu.loadDefault')
        ],
        ['#comfy-reset-view-button', legacyMenuText('legacyMenu.resetView')]
      ] as const
      for (const [selector, label] of controls) {
        const element = this.menuContainer.querySelector(selector)
        if (element) setControlLabel(element, label)
      }

      this.queueSize.textContent =
        this.displayedQueueRemaining == null
          ? legacyMenuText('legacyMenu.queueSizePlaceholder')
          : legacyMenuText('legacyMenu.queueSize', {
              count: this.displayedQueueRemaining
            })

      this.queue.applyLocalizedChrome()
      this.history.applyLocalizedChrome()
    }
    this.applyLocalizedText()
    this.startLocaleSync()
  }

  private startLocaleSync() {
    effectScope().run(() => {
      watch(
        () => legacyMenuLocaleMessages(),
        () => {
          this.applyLocalizedText()
        },
        { deep: true }
      )
    })
  }

  setStatus(status: StatusWsMessageStatus | null) {
    const queueRemaining = status?.exec_info?.queue_remaining
    if (queueRemaining == null) return

    this.displayedQueueRemaining = queueRemaining
    this.queueSize.textContent = legacyMenuText('legacyMenu.queueSize', {
      count: queueRemaining
    })
    if (
      this.lastQueueSize != 0 &&
      queueRemaining == 0 &&
      this.autoQueueEnabled &&
      (this.autoQueueMode === 'instant' || this.graphHasChanged) &&
      !app.lastExecutionError
    ) {
      void app.queuePrompt(0, this.batchCount, {
        intent: { trigger_source: 'auto_queue' }
      })
      this.graphHasChanged = false
      this.lastQueueSize = queueRemaining + this.batchCount
    } else {
      this.lastQueueSize = queueRemaining
    }
  }
}
