import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ComfyUI } from './ui'

const { mockApp } = vi.hoisted(() => ({
  mockApp: {
    handleFile: vi.fn<(file: File, source: string) => Promise<void>>(),
    showErrorOnFileLoad: vi.fn(),
    queuePrompt: vi.fn(),
    loadGraphData: vi.fn(),
    refreshComboInNodes: vi.fn(),
    openClipspace: vi.fn(),
    clean: vi.fn(),
    lastExecutionError: null
  }
}))

vi.mock('./app', () => ({
  ComfyApp: class {},
  app: mockApp
}))

vi.mock('./api', () => ({
  api: {
    addEventListener: vi.fn()
  }
}))

vi.mock('./ui/dialog', () => ({
  ComfyDialog: class {}
}))

vi.mock('./ui/settings', () => ({
  ComfySettingsDialog: class {}
}))

vi.mock('./ui/toggleSwitch', () => ({
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
    mockApp.handleFile.mockReset()
    mockApp.showErrorOnFileLoad.mockReset()
  })

  afterEach(() => {
    document.body.replaceChildren()
    vi.unstubAllGlobals()
  })

  it('reports rejected imports and resets the selected file', async () => {
    const file = new File([''], 'a1111.png', { type: 'image/png' })
    const error = new Error('import failed')
    mockApp.handleFile.mockRejectedValue(error)
    new ComfyUI(mockApp)
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
      expect(mockApp.showErrorOnFileLoad).toHaveBeenCalledWith(file)
    )
    expect(mockApp.handleFile).toHaveBeenCalledWith(file, 'file_button')
    expect(consoleError).toHaveBeenCalledWith('Failed to load file:', error)
    expect(consoleError.mock.invocationCallOrder[0]).toBeLessThan(
      mockApp.showErrorOnFileLoad.mock.invocationCallOrder[0]
    )
    expect(fileInput.value).toBe('')
  })
})
