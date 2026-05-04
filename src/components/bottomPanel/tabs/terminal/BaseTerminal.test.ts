/* eslint-disable testing-library/no-node-access */
/* eslint-disable testing-library/prefer-user-event */
import { createTestingPinia } from '@pinia/testing'
import { fireEvent, render, screen } from '@testing-library/vue'
import type { Mock } from 'vitest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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
  electronAPI: vi.fn(() => null)
}))

const mockData = vi.hoisted(() => ({ isDesktop: false }))

vi.mock('@/platform/distribution/types', () => ({
  get isDesktop() {
    return mockData.isDesktop
  }
}))

// Mock clipboard API
const mockWriteText = vi.fn().mockResolvedValue(undefined)
Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: mockWriteText
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

function renderBaseTerminal(props: Record<string, unknown> = {}) {
  return render(BaseTerminal, {
    props,
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

describe('BaseTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emits created event on mount', () => {
    const onCreated = vi.fn()
    renderBaseTerminal({ onCreated })

    expect(onCreated).toHaveBeenCalled()
    expect(onCreated.mock.calls[0]).toHaveLength(2)
  })

  it('emits unmounted event on unmount', () => {
    const onUnmounted = vi.fn()
    const { unmount } = renderBaseTerminal({ onUnmounted })
    unmount()

    expect(onUnmounted).toHaveBeenCalled()
  })

  it('button exists and has correct initial state', () => {
    renderBaseTerminal()

    const button = screen.getByRole('button')
    expect(button).toHaveClass('opacity-0', 'pointer-events-none')
  })

  it('shows correct tooltip when no selection', async () => {
    mockTerminal.hasSelection.mockReturnValue(false)
    const { container } = renderBaseTerminal()

    await fireEvent.mouseEnter(container.firstElementChild!)
    await nextTick()

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'Copy all')
  })

  it('shows correct tooltip when selection exists', async () => {
    mockTerminal.hasSelection.mockReturnValue(true)
    const { container } = renderBaseTerminal()

    // Trigger the selection change callback that was registered during mount
    expect(mockTerminal.onSelectionChange).toHaveBeenCalled()
    const mockCalls = (mockTerminal.onSelectionChange as Mock).mock.calls
    const selectionCallback = mockCalls[0][0] as () => void
    selectionCallback()
    await nextTick()

    await fireEvent.mouseEnter(container.firstElementChild!)
    await nextTick()

    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', 'Copy selection')
  })

  it('copies selected text when selection exists', async () => {
    const selectedText = 'selected text'
    mockTerminal.hasSelection.mockReturnValue(true)
    mockTerminal.getSelection.mockReturnValue(selectedText)

    const { container } = renderBaseTerminal()

    await fireEvent.mouseEnter(container.firstElementChild!)
    await nextTick()

    const button = screen.getByRole('button')
    await fireEvent.click(button)
    await nextTick()

    expect(mockTerminal.selectAll).not.toHaveBeenCalled()
    expect(mockWriteText).toHaveBeenCalledWith(selectedText)
    expect(mockTerminal.clearSelection).not.toHaveBeenCalled()
  })

  it('copies all text when no selection exists', async () => {
    const allText = 'all terminal content'
    mockTerminal.hasSelection.mockReturnValue(false)
    mockTerminal.getSelection
      .mockReturnValueOnce('') // First call returns empty (no selection)
      .mockReturnValueOnce(allText) // Second call after selectAll returns all text

    const { container } = renderBaseTerminal()

    await fireEvent.mouseEnter(container.firstElementChild!)
    await nextTick()

    const button = screen.getByRole('button')
    await fireEvent.click(button)
    await nextTick()

    expect(mockTerminal.selectAll).toHaveBeenCalled()
    expect(mockWriteText).toHaveBeenCalledWith(allText)
    expect(mockTerminal.clearSelection).toHaveBeenCalled()
  })

  it('does not copy when no text available', async () => {
    mockTerminal.hasSelection.mockReturnValue(false)
    mockTerminal.getSelection.mockReturnValue('')

    const { container } = renderBaseTerminal()

    await fireEvent.mouseEnter(container.firstElementChild!)
    await nextTick()

    const button = screen.getByRole('button')
    await fireEvent.click(button)
    await nextTick()

    expect(mockTerminal.selectAll).toHaveBeenCalled()
    expect(mockWriteText).not.toHaveBeenCalled()
  })
})
