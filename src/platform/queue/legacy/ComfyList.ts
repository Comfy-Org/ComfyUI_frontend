import { extractWorkflow } from '@comfyorg/api-client/jobs/fetchJobs'

import { api } from '@/scripts/api'
import { $el } from '@/scripts/ui/utils'

import type { LegacyQueueApp, LegacyQueueHost } from './types'

export class ComfyList {
  private _type: string
  private _text: string
  private _reverse: boolean
  element: HTMLDivElement
  button?: HTMLButtonElement

  constructor(
    private readonly app: LegacyQueueApp,
    private readonly host: LegacyQueueHost,
    text: string,
    type?: string,
    reverse?: boolean
  ) {
    this._text = text
    this._type = type || text.toLowerCase()
    this._reverse = reverse || false
    this.element = $el('div.comfy-list') as HTMLDivElement
    this.element.style.display = 'none'

    console.warn(
      '[ComfyUI] The legacy queue/history menu is deprecated. ' +
        'Core functionality in this menu may break at any time. ' +
        'Issues and feature requests related to the legacy menu will not be addressed. ' +
        'To switch to the new menu: Settings → search "Use new menu" → change from "Disabled" to "Top".'
    )
  }

  get visible() {
    return this.element.style.display !== 'none'
  }

  async load() {
    const items =
      this._type === 'history'
        ? { history: await api.getHistory() }
        : await api.getQueue()
    this.element.replaceChildren(
      ...Object.entries(items).flatMap(([section, sectionItems]) => [
        $el('h4', {
          textContent: section
        }),
        $el(
          'div.comfy-list-items',
          (this._reverse ? sectionItems.reverse() : sectionItems).map(
            (item) => {
              const removeAction =
                section === 'Running'
                  ? {
                      name: 'Cancel',
                      cb: () => api.interrupt(item.id)
                    }
                  : {
                      name: 'Delete',
                      cb: () => api.deleteItem(this._type, item.id)
                    }
              return $el('div', { textContent: item.priority + ': ' }, [
                $el('button', {
                  textContent: 'Load',
                  onclick: async () => {
                    const job = await api.getJobDetail(item.id)
                    if (!job) return
                    const workflow = await extractWorkflow(job)
                    const loaded = await this.app.loadGraphData(
                      workflow,
                      true,
                      false,
                      null,
                      { initiator: 'user' }
                    )
                    if (loaded === false) return
                    if ('outputs' in job && job.outputs) {
                      this.host.restoreOutputs(job.outputs)
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
          textContent: 'Clear ' + this._text,
          onclick: async () => {
            await api.clearItems(this._type)
            await this.load()
          }
        }),
        $el('button', { textContent: 'Refresh', onclick: () => this.load() })
      ])
    )
  }

  async update() {
    if (this.visible) {
      await this.load()
    }
  }

  async show() {
    this.element.style.display = 'block'
    if (this.button) this.button.textContent = 'Close'

    await this.load()
  }

  hide() {
    this.element.style.display = 'none'
    if (this.button) this.button.textContent = 'View ' + this._text
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
