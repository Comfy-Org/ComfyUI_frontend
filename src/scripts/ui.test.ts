import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

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
