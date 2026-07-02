import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, ref } from 'vue'

interface MockTerminalInstance {
  cols: number
  rows: number
  options: unknown
  loadAddon: ReturnType<typeof vi.fn>
  attachCustomKeyEventHandler: ReturnType<typeof vi.fn>
  open: ReturnType<typeof vi.fn>
  dispose: ReturnType<typeof vi.fn>
  resize: ReturnType<typeof vi.fn>
  hasSelection: ReturnType<typeof vi.fn>
}

interface MockFitAddonInstance {
  proposeDimensions: ReturnType<typeof vi.fn>
}

const mockXterm = vi.hoisted(() => {
  const terminalInstances: MockTerminalInstance[] = []
  const fitAddonInstances: MockFitAddonInstance[] = []

  class Terminal {
    cols = 80
    rows = 24
    loadAddon = vi.fn()
    attachCustomKeyEventHandler = vi.fn()
    open = vi.fn()
    dispose = vi.fn()
    resize = vi.fn((cols: number, rows: number) => {
      this.cols = cols
      this.rows = rows
    })
    hasSelection = vi.fn(() => false)

    constructor(readonly options: unknown) {
      terminalInstances.push(this)
    }
  }

  class FitAddon {
    proposeDimensions = vi.fn(() => ({ cols: 120, rows: 40 }))

    constructor() {
      fitAddonInstances.push(this)
    }
  }

  return {
    Terminal,
    FitAddon,
    terminalInstances,
    fitAddonInstances
  }
})

const mockResizeObserverInstances = [] as MockResizeObserver[]

class MockResizeObserver {
  observe = vi.fn()
  disconnect = vi.fn()

  constructor(readonly callback: ResizeObserverCallback) {
    mockResizeObserverInstances.push(this)
  }
}

vi.mock('@xterm/xterm', () => ({
  Terminal: mockXterm.Terminal
}))

vi.mock('@xterm/addon-fit', () => ({
  FitAddon: mockXterm.FitAddon
}))

vi.mock('es-toolkit/compat', () => ({
  debounce: (fn: () => void) => fn
}))

vi.mock('@/platform/distribution/types', () => ({
  isDesktop: true
}))

import { useTerminal } from './useTerminal'

function terminalElement() {
  const element = document.createElement('div')
  Object.defineProperty(element, 'clientWidth', { value: 160 })
  Object.defineProperty(element, 'clientHeight', { value: 100 })
  return element
}

function mountTerminal(
  configure?: (
    result: ReturnType<typeof useTerminal>,
    root: ReturnType<typeof ref<HTMLElement | undefined>>
  ) => void
) {
  let result: ReturnType<typeof useTerminal> | undefined
  const root = ref<HTMLElement | undefined>(terminalElement())
  const app = createApp(
    defineComponent({
      setup() {
        result = useTerminal(root)
        configure?.(result, root)
        return () => null
      }
    })
  )
  app.mount(document.createElement('div'))
  if (!result) throw new Error('Expected terminal composable to initialize')
  return { app, result, root }
}

describe('useTerminal', () => {
  beforeEach(() => {
    mockXterm.terminalInstances.length = 0
    mockXterm.fitAddonInstances.length = 0
    mockResizeObserverInstances.length = 0
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
  })

  it('creates a desktop themed terminal and opens it on mount', () => {
    const { app, root } = mountTerminal()
    const terminal = mockXterm.terminalInstances[0]
    const fitAddon = mockXterm.fitAddonInstances[0]

    expect(terminal.options).toMatchObject({
      convertEol: true,
      theme: { background: '#171717' }
    })
    expect(terminal.loadAddon).toHaveBeenCalledWith(fitAddon)
    expect(terminal.open).toHaveBeenCalledWith(root.value)

    app.unmount()
    expect(terminal.dispose).toHaveBeenCalledOnce()
  })

  it('lets browser copy and paste shortcuts pass through', () => {
    mountTerminal()
    const terminal = mockXterm.terminalInstances[0]
    const handler = terminal.attachCustomKeyEventHandler.mock.calls[0][0] as (
      event: KeyboardEvent
    ) => boolean

    terminal.hasSelection.mockReturnValue(true)
    expect(
      handler(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }))
    ).toBe(false)
    expect(
      handler(new KeyboardEvent('keydown', { key: 'v', metaKey: true }))
    ).toBe(false)

    terminal.hasSelection.mockReturnValue(false)
    expect(
      handler(new KeyboardEvent('keydown', { key: 'c', ctrlKey: true }))
    ).toBe(true)
    expect(
      handler(new KeyboardEvent('keyup', { key: 'v', ctrlKey: true }))
    ).toBe(true)
  })

  it('auto-sizes from fit dimensions and disconnects the observer on unmount', () => {
    const onResize = vi.fn()
    const { app, root } = mountTerminal((terminal, rootRef) => {
      terminal.useAutoSize({
        root: rootRef,
        minCols: 100,
        minRows: 20,
        onResize
      })
    })
    const terminal = mockXterm.terminalInstances[0]
    const observer = mockResizeObserverInstances[0]

    expect(observer.observe).toHaveBeenCalledWith(root.value)
    expect(terminal.resize).toHaveBeenCalledWith(120, 40)
    expect(onResize).toHaveBeenCalledOnce()

    app.unmount()
    expect(observer.disconnect).toHaveBeenCalledOnce()
  })

  it('estimates invalid fit dimensions from the root element', () => {
    const { result, root } = mountTerminal()
    const fitAddon = mockXterm.fitAddonInstances[0]
    fitAddon.proposeDimensions.mockReturnValue({
      cols: Number.NaN,
      rows: undefined
    })
    const { resize } = result.useAutoSize({ root, minCols: 30, minRows: 10 })
    const terminal = mockXterm.terminalInstances[0]

    resize()

    expect(terminal.resize).toHaveBeenLastCalledWith(30, 10)
  })

  it('keeps existing terminal dimensions when auto sizing is disabled', () => {
    const { result, root } = mountTerminal()
    const terminal = mockXterm.terminalInstances[0]
    terminal.cols = 90
    terminal.rows = 30
    const { resize } = result.useAutoSize({
      root,
      autoCols: false,
      autoRows: false,
      minCols: 10,
      minRows: 10
    })

    resize()

    expect(terminal.resize).toHaveBeenLastCalledWith(90, 30)
  })
})
