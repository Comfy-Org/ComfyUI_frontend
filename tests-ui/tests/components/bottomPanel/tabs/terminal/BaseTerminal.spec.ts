import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'

import BaseTerminal from '@/components/bottomPanel/tabs/terminal/BaseTerminal.vue'

// Mock xterm and related modules
vi.mock('@xterm/xterm', () => ({
  Terminal: vi.fn().mockImplementation(() => ({
    open: vi.fn(),
    dispose: vi.fn(),
    onSelectionChange: vi.fn(() => {
      // Return a disposable
      return {
        dispose: vi.fn()
      }
    }),
    hasSelection: vi.fn(() => false),
    getSelection: vi.fn(() => ''),
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
    loadAddon: vi.fn()
  })),
  IDisposable: vi.fn()
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: vi.fn().mockImplementation(() => ({
    fit: vi.fn(),
    proposeDimensions: vi.fn(() => ({ rows: 24, cols: 80 }))
  }))
}))

const mockTerminal = {
  open: vi.fn(),
  dispose: vi.fn(),
  onSelectionChange: vi.fn(() => ({
    dispose: vi.fn()
  })),
  hasSelection: vi.fn(() => false),
  getSelection: vi.fn(() => ''),
  selectAll: vi.fn(),
  clearSelection: vi.fn()
}

vi.mock('@/composables/bottomPanelTabs/useTerminal', () => ({
  useTerminal: vi.fn(() => ({
    terminal: mockTerminal,
    useAutoSize: vi.fn(() => ({ resize: vi.fn() }))
  }))
}))

vi.mock('@/utils/envUtil', () => ({
  isElectron: vi.fn(() => false),
  electronAPI: vi.fn(() => null)
}))

// Mock clipboard API
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: vi.fn().mockResolvedValue(undefined)
  },
  configurable: true
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      serverStart: {
        copySelectionTooltip: 'Copy selection',
        copyAllTooltip: 'Copy all'
      }
    }
  }
})

describe('BaseTerminal', () => {
  let wrapper: any
  let terminalMock: any

  const mountBaseTerminal = () => {
    return mount(BaseTerminal, {
      global: {
        plugins: [
          createTestingPinia({
            createSpy: vi.fn
          }),
          i18n
        ],
        stubs: {
          Button: {
            template: '<button v-bind="$attrs"><slot /></button>',
            props: ['icon', 'severity', 'size']
          }
        }
      }
    })
  }

  beforeEach(() => {
    vi.clearAllMocks()
    terminalMock = mockTerminal
  })

  afterEach(() => {
      wrapper?.unmount()
  })

  it('emits created event on mount', () => {
    wrapper = mountBaseTerminal()

    expect(wrapper.emitted('created')).toBeTruthy()
    expect(wrapper.emitted('created')[0]).toHaveLength(2)
  })

  it('emits unmounted event on unmount', () => {
    wrapper = mountBaseTerminal()
    wrapper.unmount()

    expect(wrapper.emitted('unmounted')).toBeTruthy()
  })

  it('button exists and has correct initial state', async () => {
    wrapper = mountBaseTerminal()

    const button = wrapper.find('button[aria-label]')
    expect(button.exists()).toBe(true)

    expect(button.classes()).toContain('opacity-0')
    expect(button.classes()).toContain('pointer-events-none')
  })

  it('shows correct tooltip when no selection', async () => {
    terminalMock.hasSelection.mockReturnValue(false)
    wrapper = mountBaseTerminal()

    await wrapper.trigger('mouseenter')
    await nextTick()

    const button = wrapper.find('button[aria-label]')
    expect(button.attributes('aria-label')).toBe('Copy all')
  })

  it('shows correct tooltip when selection exists', async () => {
    terminalMock.hasSelection.mockReturnValue(true)
    wrapper = mountBaseTerminal()

    const selectionCallback = terminalMock.onSelectionChange.mock.calls[0][0]
    selectionCallback()
    await nextTick()

    await wrapper.trigger('mouseenter')
    await nextTick()

    const button = wrapper.find('button[aria-label]')
    expect(button.attributes('aria-label')).toBe('Copy selection')
  })

  it('copies selected text when selection exists', async () => {
    const selectedText = 'selected text'
    terminalMock.hasSelection.mockReturnValue(true)
    terminalMock.getSelection.mockReturnValue(selectedText)

    wrapper = mountBaseTerminal()

    await wrapper.trigger('mouseenter')
    await nextTick()

    const button = wrapper.find('button[aria-label]')
    await button.trigger('click')

    expect(terminalMock.selectAll).not.toHaveBeenCalled()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(selectedText)
    expect(terminalMock.clearSelection).not.toHaveBeenCalled()
  })

  it('copies all text when no selection exists', async () => {
    const allText = 'all terminal content'
    terminalMock.hasSelection.mockReturnValue(false)
    terminalMock.getSelection
      .mockReturnValueOnce('') // First call returns empty (no selection)
      .mockReturnValueOnce(allText) // Second call after selectAll returns all text

    wrapper = mountBaseTerminal()

    await wrapper.trigger('mouseenter')
    await nextTick()

    const button = wrapper.find('button[aria-label]')
    await button.trigger('click')

    expect(terminalMock.selectAll).toHaveBeenCalled()
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(allText)
    expect(terminalMock.clearSelection).toHaveBeenCalled()
  })

  it('does not copy when no text available', async () => {
    terminalMock.hasSelection.mockReturnValue(false)
    terminalMock.getSelection.mockReturnValue('')

    wrapper = mountBaseTerminal()

    await wrapper.trigger('mouseenter')
    await nextTick()

    const button = wrapper.find('button[aria-label]')
    await button.trigger('click')

    expect(terminalMock.selectAll).toHaveBeenCalled()
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled()
  })
})
