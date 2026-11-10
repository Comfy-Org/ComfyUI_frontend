import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { markGraphLoadFailurePresented } from '@/services/graphLoadFailure'

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

vi.mock(import('./ui/toggleSwitch'), () => ({
  toggleSwitch: vi.fn(() => document.createElement('div'))
}))

function giveDialogDoublesRemovableElements(ui: ComfyUI) {
  ui.dialog.element = document.createElement('div')
  ui.settings.element = document.createElement('dialog')
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
    new ComfyUI(app, {
      resetView: vi.fn(),
      restoreOutputs: vi.fn(),
      trackRunButton: vi.fn(),
      enterFocusMode: vi.fn()
    })
    const fileInput = document.getElementById(
      'comfy-file-input'
    ) as HTMLInputElement
    Object.defineProperties(fileInput, {
      files: { value: [file], configurable: true },
      value: { value: 'a1111.png', writable: true, configurable: true }
    })

    fileInput.dispatchEvent(new Event('change'))

    await vi.waitFor(() =>
      expect(app.showErrorOnFileLoad).toHaveBeenCalledWith(file)
    )
    expect(app.handleFile).toHaveBeenCalledWith(file, 'file_button')
    expect(console.error).toHaveBeenCalledWith('Failed to load file:', error)
    expect(vi.mocked(console.error).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(app.showErrorOnFileLoad).mock.invocationCallOrder[0]
    )
    expect(fileInput.value).toBe('')
  })

  it('does not warn again when a rejected import was already presented', async ({
    onTestFinished
  }) => {
    const file = new File([''], 'a1111.png', { type: 'image/png' })
    const error = markGraphLoadFailurePresented(new Error('import failed'))
    vi.mocked(app.handleFile).mockRejectedValue(error)
    const ui = new ComfyUI(app, {
      resetView: vi.fn(),
      restoreOutputs: vi.fn(),
      trackRunButton: vi.fn(),
      enterFocusMode: vi.fn()
    })
    giveDialogDoublesRemovableElements(ui)
    onTestFinished(() => ui.dispose())
    const fileInput = document.getElementById(
      'comfy-file-input'
    ) as HTMLInputElement
    Object.defineProperties(fileInput, {
      files: { value: [file], configurable: true },
      value: { value: 'a1111.png', writable: true, configurable: true }
    })

    fileInput.dispatchEvent(new Event('change'))

    await vi.waitFor(() =>
      expect(app.handleFile).toHaveBeenCalledWith(file, 'file_button')
    )
    expect(app.showErrorOnFileLoad).not.toHaveBeenCalled()
    expect(fileInput.value).toBe('')
  })
})
