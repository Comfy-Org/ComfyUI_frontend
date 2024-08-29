import { ComfyButton } from '../components/button'
import { $el } from '../../ui'
import { api } from '../../api'
import { ComfySplitButton } from '../components/splitButton'
import { ComfyQueueOptions } from './queueOptions'
import { prop } from '../../utils'
import type { ComfyApp } from '@/scripts/app'
import { StatusWsMessageStatus } from '@/types/apiTypes'

export class ComfyQueueButton {
  element = $el('div.comfyui-queue-button')
  #internalQueueSize = 0

  queuePrompt = async (e?: MouseEvent) => {
    this.#internalQueueSize += this.queueOptions.batchCount
    // Hold shift to queue front, event is undefined when auto-queue is enabled
    await this.app.queuePrompt(
      e?.shiftKey ? -1 : 0,
      this.queueOptions.batchCount
    )
  }
  queueOptions: ComfyQueueOptions
  app: ComfyApp
  autoQueueMode: string
  graphHasChanged: boolean

  constructor(app: ComfyApp) {
    this.app = app

    const queue = new ComfyButton({
      content: $el('div', [
        $el('span', {
          textContent: 'Queue'
        })
      ]),
      icon: 'play',
      classList: 'comfyui-button',
      action: this.queuePrompt
    })

    this.queueOptions = new ComfyQueueOptions(app)

    const btn = new ComfySplitButton(
      {
        primary: queue,
        mode: 'click',
        position: 'absolute',
        horizontal: 'right'
      },
      this.queueOptions.element
    )
    btn.element.classList.add('primary')
    this.element.append(btn.element)

    this.autoQueueMode = prop(this, 'autoQueueMode', '', () => {
      switch (this.autoQueueMode) {
        case 'instant':
          queue.icon = 'infinity'
          break
        case 'change':
          queue.icon = 'auto-mode'
          break
        default:
          queue.icon = 'play'
          break
      }
    })

    this.queueOptions.addEventListener(
      'autoQueueMode',
      (e) => (this.autoQueueMode = e['detail'])
    )

    api.addEventListener('graphChanged', () => {
      if (this.autoQueueMode === 'change') {
        if (this.#internalQueueSize) {
          this.graphHasChanged = true
        } else {
          this.graphHasChanged = false
          this.queuePrompt()
        }
      }
    })

    api.addEventListener(
      'status',
      ({ detail }: CustomEvent<StatusWsMessageStatus>) => {
        this.#internalQueueSize = detail?.exec_info?.queue_remaining
        if (this.#internalQueueSize != null) {
          if (!this.#internalQueueSize && !app.lastExecutionError) {
            if (
              this.autoQueueMode === 'instant' ||
              (this.autoQueueMode === 'change' && this.graphHasChanged)
            ) {
              this.graphHasChanged = false
              this.queuePrompt()
            }
          }
        }
      }
    )
  }
}
