import { fromAny } from '@total-typescript/shoehorn'
import { nextTick, toRaw } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import type { JobListItem } from '@/platform/remote/comfyui/jobs/jobTypes'
import { useSettingStore } from '@/platform/settings/settingStore'

import { api } from './api'
import { app } from './app'
import { ComfyUI } from './ui'

vi.mock(import('./app'))

vi.mock(import('./api'))

vi.mock(import('./ui/dialog'), () => ({
  ComfyDialog: fromAny(class {})
}))

vi.mock(import('./ui/settings'), () => ({
  ComfySettingsDialog: fromAny(class {})
}))

const queuedJob = {
  id: 'job-1',
  status: 'pending',
  create_time: 0,
  outputs_count: null,
  previewable_outputs_count: null,
  priority: 4
} satisfies JobListItem

function buttonText(root: ParentNode, selector: string) {
  return root.querySelector(selector)?.textContent
}

function controlTexts(root: ParentNode, selector: string) {
  return [...root.querySelectorAll(selector)].map(
    (element) => element.textContent
  )
}

describe('ComfyUI file input', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn()
        disconnect = vi.fn()
        unobserve = vi.fn()
      }
    )
  })

  it('reports rejected imports and resets the selected file', async () => {
    const file = new File([''], 'a1111.png', { type: 'image/png' })
    const error = new Error('import failed')
    vi.mocked(app.handleFile).mockRejectedValue(error)
    new ComfyUI(app)
    const fileInput = document.getElementById(
      'comfy-file-input'
    ) as HTMLInputElement
    Object.defineProperties(fileInput, {
      files: { value: [file], configurable: true },
      value: { value: 'a1111.png', writable: true, configurable: true }
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    fileInput.dispatchEvent(new Event('change'))

    await vi.waitFor(() =>
      expect(app.showErrorOnFileLoad).toHaveBeenCalledWith(file)
    )
    expect(app.handleFile).toHaveBeenCalledWith(file, 'file_button')
    expect(consoleError).toHaveBeenCalledWith('Failed to load file:', error)
    expect(consoleError.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(app.showErrorOnFileLoad).mock.invocationCallOrder[0]
    )
    expect(fileInput.value).toBe('')
  })
})

describe('legacy menu copy', () => {
  beforeEach(() => {
    vi.mocked(api.interrupt).mockClear()
    vi.mocked(api.deleteItem).mockClear()
    vi.mocked(api.clearItems).mockClear()
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn()
        disconnect = vi.fn()
        unobserve = vi.fn()
      }
    )
  })

  it('renders the legacy toolbar in English', () => {
    const ui = new ComfyUI(app)

    expect(
      [
        '#queue-button',
        '#queue-front-button',
        '#comfy-view-queue-button',
        '#comfy-view-history-button',
        '#comfy-save-button',
        '#comfy-dev-save-api-button',
        '#comfy-load-button',
        '#comfy-refresh-button',
        '#comfy-clipspace-button',
        '#comfy-clear-button',
        '#comfy-load-default-button',
        '#comfy-reset-view-button'
      ].map((selector) => buttonText(ui.menuContainer, selector))
    ).toEqual([
      'Queue Prompt',
      'Queue Front',
      'View Queue',
      'View History',
      'Save',
      'Save (API Format)',
      'Load',
      'Refresh',
      'Clipspace',
      'Clear',
      'Load Default',
      'Reset View'
    ])
    expect(
      [...ui.menuContainer.querySelectorAll('label')].map(
        (label) => label.textContent
      )
    ).toEqual([
      'Extra options',
      'Batch count',
      'Auto Queue',
      'instant',
      'change'
    ])
    expect(ui.queueSize.textContent).toBe('Queue size: X')
  })

  it('keeps auto-queue mode values stable while translating their labels', () => {
    const ui = new ComfyUI(app)
    const modeLabels = [
      ...ui.menuContainer.querySelectorAll<HTMLLabelElement>(
        '.comfy-toggle-switch label'
      )
    ]
    const autoQueue = ui.menuContainer.querySelector('#autoQueueCheckbox')

    expect(modeLabels.map((label) => label.title)).toEqual([
      'A new prompt will be queued as soon as the queue reaches 0',
      'A new prompt will be queued when the queue is at 0 and the graph is/has changed'
    ])
    expect(
      modeLabels.map((label) => label.querySelector('input')?.value)
    ).toEqual(['instant', 'change'])
    expect(ui.autoQueueMode).toBe('instant')
    modeLabels[1]?.querySelector('input')?.dispatchEvent(new Event('change'))
    expect(ui.autoQueueMode).toBe('change')
    expect(autoQueue).toBeInstanceOf(HTMLInputElement)
    if (autoQueue instanceof HTMLInputElement) {
      expect(autoQueue.title).toBe(
        'Automatically queue prompt when the queue size hits 0'
      )
    }
  })

  it('confirms clear and load-default in English', () => {
    const ui = new ComfyUI(app)
    useSettingStore().settingValues['Comfy.ConfirmClear'] = true
    const confirm = vi.fn(() => false)
    vi.stubGlobal('confirm', confirm)

    ui.menuContainer
      .querySelector('#comfy-clear-button')
      ?.dispatchEvent(new MouseEvent('click'))
    ui.menuContainer
      .querySelector('#comfy-load-default-button')
      ?.dispatchEvent(new MouseEvent('click'))

    expect(confirm).toHaveBeenNthCalledWith(1, 'Clear workflow?')
    expect(confirm).toHaveBeenNthCalledWith(2, 'Load default workflow?')
    expect(app.clean).not.toHaveBeenCalled()
  })

  it('renders English queue and history list actions', async () => {
    vi.mocked(api.getQueue).mockResolvedValue({
      Running: [{ ...queuedJob, id: 'running', status: 'in_progress' }],
      Pending: [queuedJob]
    })
    vi.mocked(api.getHistory).mockResolvedValue([
      { ...queuedJob, id: 'done', status: 'completed' }
    ])
    const ui = new ComfyUI(app)

    await ui.queue.show()
    expect(controlTexts(ui.queue.element, 'h4')).toEqual(['Running', 'Pending'])
    expect(controlTexts(ui.queue.element, 'button')).toEqual([
      'Load',
      'Cancel',
      'Load',
      'Delete',
      'Clear Queue',
      'Refresh'
    ])
    expect(ui.queue.button?.textContent).toBe('Close')

    await ui.history.show()
    expect(controlTexts(ui.history.element, 'h4')).toEqual(['history'])
    expect(controlTexts(ui.history.element, 'button')).toEqual([
      'Load',
      'Delete',
      'Clear History',
      'Refresh'
    ])
    ui.history.hide()
    expect(ui.history.button?.textContent).toBe('View History')
    ui.queue.hide()
    expect(ui.queue.button?.textContent).toBe('View Queue')
  })

  async function openQueue() {
    vi.mocked(api.getQueue).mockResolvedValue({
      Running: [{ ...queuedJob, id: 'running', status: 'in_progress' }],
      Pending: [{ ...queuedJob, id: 'pending' }]
    })
    const ui = new ComfyUI(app)
    await ui.queue.show()
    return ui
  }

  async function openHistory() {
    vi.mocked(api.getHistory).mockResolvedValue([
      { ...queuedJob, id: 'done', status: 'completed' }
    ])
    const ui = new ComfyUI(app)
    await ui.history.show()
    return ui
  }

  function clickLabel(root: ParentNode, label: string) {
    const button = [...root.querySelectorAll('button')].find(
      (element) => element.textContent === label
    )
    if (!(button instanceof HTMLButtonElement)) {
      throw new Error(`Missing button: ${label}`)
    }
    button.click()
  }

  it('cancels a running queue item', async () => {
    const ui = await openQueue()

    clickLabel(ui.queue.element, 'Cancel')

    await vi.waitFor(() =>
      expect(api.interrupt).toHaveBeenCalledWith('running')
    )
    expect(api.deleteItem).not.toHaveBeenCalled()
  })

  it('deletes a pending queue item', async () => {
    const ui = await openQueue()

    clickLabel(ui.queue.element, 'Delete')

    await vi.waitFor(() =>
      expect(api.deleteItem).toHaveBeenCalledWith('queue', 'pending')
    )
    expect(api.interrupt).not.toHaveBeenCalled()
  })

  it('deletes a history item', async () => {
    const ui = await openHistory()

    clickLabel(ui.history.element, 'Delete')

    await vi.waitFor(() =>
      expect(api.deleteItem).toHaveBeenCalledWith('history', 'done')
    )
  })

  it('clears the queue', async () => {
    const ui = await openQueue()

    clickLabel(ui.queue.element, 'Clear Queue')

    await vi.waitFor(() => expect(api.clearItems).toHaveBeenCalledWith('queue'))
  })

  it('clears history', async () => {
    const ui = await openHistory()

    clickLabel(ui.history.element, 'Clear History')

    await vi.waitFor(() =>
      expect(api.clearItems).toHaveBeenCalledWith('history')
    )
  })

  it('refreshes legacy menu labels when locale messages change', async () => {
    const ui = new ComfyUI(app)
    const queueButton = ui.menuContainer.querySelector('#queue-button')
    expect(queueButton?.textContent).toBe('Queue Prompt')

    const original = i18n.global.getLocaleMessage('en')
    const translated = structuredClone(toRaw(original))
    if (translated == null) throw new Error('English locale is not loaded')
    translated.legacyMenu.queuePrompt = 'Translated Queue Prompt'
    try {
      i18n.global.setLocaleMessage('en', translated)
      await nextTick()
      expect(queueButton?.textContent).toBe('Translated Queue Prompt')
      expect(buttonText(ui.menuContainer, '#comfy-save-button')).toBe('Save')
    } finally {
      i18n.global.setLocaleMessage('en', original)
      await nextTick()
    }
  })
})
