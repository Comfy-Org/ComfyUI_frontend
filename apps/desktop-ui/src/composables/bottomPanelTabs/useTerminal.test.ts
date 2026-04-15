import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'

const { mockTerminal, MockTerminal, mockFitAddon, MockFitAddon } = vi.hoisted(
  () => {
    const mockTerminal = {
      loadAddon: vi.fn(),
      attachCustomKeyEventHandler: vi.fn(),
      open: vi.fn(),
      dispose: vi.fn(),
      hasSelection: vi.fn<[], boolean>(),
      resize: vi.fn(),
      cols: 80,
      rows: 24
    }
    const MockTerminal = vi.fn(function () {
      return mockTerminal
    })

    const mockFitAddon = {
      proposeDimensions: vi.fn().mockReturnValue({ cols: 80, rows: 24 })
    }
    const MockFitAddon = vi.fn(function () {
      return mockFitAddon
    })

    return { mockTerminal, MockTerminal, mockFitAddon, MockFitAddon }
  }
)

vi.mock('@xterm/xterm', () => ({ Terminal: MockTerminal }))
vi.mock('@xterm/addon-fit', () => ({ FitAddon: MockFitAddon }))
vi.mock('@xterm/xterm/css/xterm.css', () => ({}))

import { useTerminal } from '@/composables/bottomPanelTabs/useTerminal'

function withSetup<T>(composable: () => T): T {
  let result!: T
  render(
    defineComponent({
      setup() {
        result = composable()
        return {}
      },
      template: '<div />'
    })
  )
  return result
}

function getKeyHandler(): (event: KeyboardEvent) => boolean {
  return mockTerminal.attachCustomKeyEventHandler.mock.calls[0][0]
}

describe('useTerminal key event handler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockTerminal.hasSelection.mockReturnValue(false)

    const element = ref<HTMLElement | undefined>(undefined)
    withSetup(() => useTerminal(element))
  })

  it('allows browser to handle copy when text is selected (Ctrl+C)', () => {
    mockTerminal.hasSelection.mockReturnValue(true)
    const event = {
      type: 'keydown',
      ctrlKey: true,
      metaKey: false,
      key: 'c'
    } as KeyboardEvent
    expect(getKeyHandler()(event)).toBe(false)
  })

  it('allows browser to handle copy when text is selected (Meta+C)', () => {
    mockTerminal.hasSelection.mockReturnValue(true)
    const event = {
      type: 'keydown',
      ctrlKey: false,
      metaKey: true,
      key: 'c'
    } as KeyboardEvent
    expect(getKeyHandler()(event)).toBe(false)
  })

  it('does not pass copy to browser when no text is selected', () => {
    mockTerminal.hasSelection.mockReturnValue(false)
    const event = {
      type: 'keydown',
      ctrlKey: true,
      metaKey: false,
      key: 'c'
    } as KeyboardEvent
    expect(getKeyHandler()(event)).toBe(true)
  })

  it('allows browser to handle paste (Ctrl+V)', () => {
    const event = {
      type: 'keydown',
      ctrlKey: true,
      metaKey: false,
      key: 'v'
    } as KeyboardEvent
    expect(getKeyHandler()(event)).toBe(false)
  })

  it('allows browser to handle paste (Meta+V)', () => {
    const event = {
      type: 'keydown',
      ctrlKey: false,
      metaKey: true,
      key: 'v'
    } as KeyboardEvent
    expect(getKeyHandler()(event)).toBe(false)
  })

  it('does not intercept non-keydown events', () => {
    mockTerminal.hasSelection.mockReturnValue(true)
    const event = {
      type: 'keyup',
      ctrlKey: true,
      metaKey: false,
      key: 'c'
    } as KeyboardEvent
    expect(getKeyHandler()(event)).toBe(true)
  })

  it('passes through unrelated key combinations', () => {
    const event = {
      type: 'keydown',
      ctrlKey: false,
      metaKey: false,
      key: 'Enter'
    } as KeyboardEvent
    expect(getKeyHandler()(event)).toBe(true)
  })
})
