import type { Point2D as Position2D } from '@comfyorg/shared-frontend-utils/geometry'
import { useSettingsDialog } from '@/platform/settings/composables/useSettingsDialog'
import { useSettingStore } from '@/platform/settings/settingStore'
import { safeLocalStorage } from '@/base/storage/safeStorage'
import { useTelemetry } from '@comfyorg/telemetry'
import { WORKFLOW_ACCEPT_STRING } from '@/platform/workflow/core/types/formats'
import type { StatusWsMessageStatus } from '@comfyorg/api-client/executionTypes'
import type {
  WorkflowOpenSource,
  WorkflowQueueIntent
} from '@comfyorg/telemetry/types'
import { useCommandStore } from '@/platform/keybindings/commandStore'
import { ComfyList } from '@/platform/queue/legacy/ComfyList'
import type {
  LegacyQueueApp,
  LegacyQueueHost
} from '@/platform/queue/legacy/types'
import {
  setupLegacyAutoQueue,
  updateLegacyAutoQueueStatus
} from '@/platform/queue/runtime/legacyAutoQueue'
import { isGraphLoadFailurePresented } from '@/services/graphLoadFailure'

import { api } from './api'
import { ComfyDialog as _ComfyDialog } from './ui/dialog'
import { $el as _$el } from './ui/utils'
import { ComfySettingsDialog } from './ui/settings'
import { toggleSwitch } from './ui/toggleSwitch'

export const ComfyDialog = _ComfyDialog
export const $el = _$el

export interface LegacyUIApp extends LegacyQueueApp {
  showErrorOnFileLoad(file: File): void
  handleFile(
    file: File,
    openSource?: WorkflowOpenSource,
    options?: { initiator?: 'user' }
  ): Promise<void | false>
  refreshComboInNodes(): Promise<boolean>
  openClipspace(): void
  clean(): void
}

export interface LegacyMenuHost extends LegacyQueueHost {
  resetView(): void
  trackRunButton(intent: WorkflowQueueIntent): void
  enterFocusMode(): void
}

function dragElement(dragEl: HTMLElement, signal: AbortSignal): () => void {
  let posDiffX = 0,
    posDiffY = 0,
    posStartX = 0,
    posStartY = 0,
    newPosX = 0,
    newPosY = 0
  const dragHandle = dragEl.querySelector<HTMLElement>('.drag-handle')
  if (dragHandle) {
    dragHandle.onmousedown = dragMouseDown
  } else {
    dragEl.onmousedown = dragMouseDown
  }

  const resizeObserver = new ResizeObserver(() => {
    ensureInBounds()
  })
  resizeObserver.observe(dragEl)
  signal.addEventListener('abort', () => {
    resizeObserver.disconnect()
    if (document.onmousemove === elementDrag) closeDragElement()
  })

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
      return
    }
  }

  function positionElement() {
    if (dragEl.style.display === 'none') return

    const halfWidth = document.body.clientWidth / 2
    const anchorRight = newPosX + dragEl.clientWidth / 2 > halfWidth

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
      safeLocalStorage.setItem(
        'Comfy.MenuPosition',
        JSON.stringify({
          x: dragEl.offsetLeft,
          y: dragEl.offsetTop
        })
      )
    }
  }

  function restorePos() {
    let pos: Position2D
    try {
      const posString = safeLocalStorage.getItem('Comfy.MenuPosition')
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
    posStartX = e.clientX
    posStartY = e.clientY
    document.onmouseup = closeDragElement
    document.onmousemove = elementDrag
  }

  function elementDrag(e: MouseEvent) {
    e.preventDefault()

    dragEl.classList.add('comfy-menu-manual-pos')

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

  window.addEventListener(
    'resize',
    () => {
      ensureInBounds()
    },
    { signal }
  )

  function closeDragElement() {
    document.onmouseup = null
    document.onmousemove = null
  }

  return restorePos
}

export class ComfyUI {
  app: LegacyUIApp
  private readonly host: LegacyMenuHost
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
  restoreMenuPosition = () => {}
  loadFile = () => {}
  private readonly lifetime = new AbortController()
  private fileInput: HTMLInputElement | undefined

  constructor(app: LegacyUIApp, host: LegacyMenuHost) {
    this.app = app
    this.host = host
    this.dialog = new ComfyDialog()
    this.settings = new ComfySettingsDialog()

    this.batchCount = 1
    this.lastQueueSize = 0
    this.queue = new ComfyList(app, host, 'Queue')
    this.history = new ComfyList(app, host, 'History', 'history', true)

    api.addEventListener(
      'status',
      () => {
        void this.queue.update()
        void this.history.update()
      },
      { signal: this.lifetime.signal }
    )

    this.setup(document.body)
  }

  /** Removes the legacy menu and dialogs and stops their listeners. */
  dispose() {
    this.lifetime.abort()
    this.dialog.element.remove()
    this.settings.element.remove()
    this.fileInput?.remove()
    this.menuContainer.remove()
  }

  setup(containerElement: HTMLElement) {
    const fileInput = $el('input', {
      id: 'comfy-file-input',
      dataset: { testid: 'comfy-file-input' },
      type: 'file',
      accept: WORKFLOW_ACCEPT_STRING,
      style: { display: 'none' },
      parent: document.body,
      onchange: async () => {
        const file = fileInput.files?.[0]
        if (file) {
          try {
            await this.app.handleFile(file, 'file_button', {
              initiator: 'user'
            })
          } catch (error) {
            console.error('Failed to load file:', error)
            if (!isGraphLoadFailurePresented(error))
              this.app.showErrorOnFileLoad(file)
          } finally {
            fileInput.value = ''
          }
        }
      }
    })
    this.fileInput = fileInput

    this.loadFile = () => fileInput.click()

    const autoQueueModeEl = toggleSwitch(
      'autoQueueMode',
      [
        {
          text: 'instant',
          tooltip: 'A new prompt will be queued as soon as the queue reaches 0'
        },
        {
          text: 'change',
          tooltip:
            'A new prompt will be queued when the queue is at 0 and the graph is/has changed'
        }
      ],
      {
        onChange: (value) => {
          this.autoQueueMode = value.item.value
        }
      }
    )
    autoQueueModeEl.style.display = 'none'

    setupLegacyAutoQueue(this, this.lifetime.signal)

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
                  this.host.enterFocusMode()
                }
              })
            ])
          ]
        ),
        $el('button.comfy-queue-btn', {
          id: 'queue-button',
          textContent: 'Queue Prompt',
          onclick: () => {
            const workflowQueueIntent = {
              trigger_source: 'legacy_ui'
            } as const
            this.host.trackRunButton(workflowQueueIntent)
            useTelemetry()?.trackWorkflowExecution()
            void this.app.queuePrompt(0, this.batchCount, {
              intent: workflowQueueIntent
            })
          }
        }),
        $el('div', {}, [
          $el('label', { innerHTML: 'Extra options' }, [
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
              $el('label', { innerHTML: 'Batch count' }),
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
                innerHTML: 'Auto Queue'
              }),
              $el('input', {
                id: 'autoQueueCheckbox',
                type: 'checkbox',
                checked: false,
                title: 'Automatically queue prompt when the queue size hits 0',
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
            textContent: 'Queue Front',
            onclick: () => {
              const workflowQueueIntent = {
                trigger_source: 'legacy_ui'
              } as const
              this.host.trackRunButton(workflowQueueIntent)
              useTelemetry()?.trackWorkflowExecution()
              void this.app.queuePrompt(-1, this.batchCount, {
                intent: workflowQueueIntent
              })
            }
          }),
          $el('button', {
            $: (b) => (this.queue.button = b as HTMLButtonElement),
            id: 'comfy-view-queue-button',
            textContent: 'View Queue',
            onclick: () => {
              this.history.hide()
              this.queue.toggle()
            }
          }),
          $el('button', {
            $: (b) => (this.history.button = b as HTMLButtonElement),
            id: 'comfy-view-history-button',
            textContent: 'View History',
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
          textContent: 'Save',
          onclick: () => {
            void useCommandStore().execute('Comfy.ExportWorkflow')
          }
        }),
        $el('button', {
          id: 'comfy-dev-save-api-button',
          textContent: 'Save (API Format)',
          style: { width: '100%', display: 'none' },
          onclick: () => {
            void useCommandStore().execute('Comfy.ExportWorkflowAPI')
          }
        }),
        $el('button', {
          id: 'comfy-load-button',
          textContent: 'Load',
          onclick: () => fileInput.click()
        }),
        $el('button', {
          id: 'comfy-refresh-button',
          textContent: 'Refresh',
          onclick: () => {
            void this.app.refreshComboInNodes().catch(() => {})
          }
        }),
        $el('button', {
          id: 'comfy-clipspace-button',
          textContent: 'Clipspace',
          onclick: () => this.app.openClipspace()
        }),
        $el('button', {
          id: 'comfy-clear-button',
          textContent: 'Clear',
          onclick: () => {
            if (
              !useSettingStore().get('Comfy.ConfirmClear') ||
              confirm('Clear workflow?')
            ) {
              this.app.clean()
              this.host.resetView()
              api.dispatchCustomEvent('graphCleared')
            }
          }
        }),
        $el('button', {
          id: 'comfy-load-default-button',
          textContent: 'Load Default',
          onclick: async () => {
            if (
              !useSettingStore().get('Comfy.ConfirmClear') ||
              confirm('Load default workflow?')
            ) {
              this.host.resetView()
              await this.app.loadGraphData(undefined, true, true, null, {
                initiator: 'user'
              })
            }
          }
        }),
        $el('button', {
          id: 'comfy-reset-view-button',
          textContent: 'Reset View',
          onclick: async () => {
            this.host.resetView()
          }
        })
      ]
    ) as HTMLDivElement
    this.menuContainer.style.display = 'none'

    this.restoreMenuPosition = dragElement(
      this.menuContainer,
      this.lifetime.signal
    )

    this.queueSize.textContent = 'Queue size: X'
  }

  setStatus(status: StatusWsMessageStatus | null) {
    const queueRemaining = status?.exec_info?.queue_remaining
    if (queueRemaining == null) return

    this.queueSize.textContent = 'Queue size: ' + queueRemaining
    updateLegacyAutoQueueStatus(this, queueRemaining)
  }
}
