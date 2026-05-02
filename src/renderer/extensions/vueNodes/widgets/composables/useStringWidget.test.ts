import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as LitegraphModule from '@/lib/litegraph/src/litegraph'
import type * as FeedbackModule from '@/lib/litegraph/src/utils/feedback'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useStringWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useStringWidget'

type TestWidget = {
  element: HTMLTextAreaElement
  options: {
    getValue?: () => string
    setValue?: (value: string) => void
    minNodeSize?: [number, number]
  }
  value: string
  callback: ReturnType<typeof vi.fn>
  dynamicPrompts?: boolean
}

const processMouseDown = vi.fn()
const processMouseMove = vi.fn()
const processMouseUp = vi.fn()
const processMouseWheel = vi.fn()
const settings = new Map<string, boolean>()
let widgetState: { value: unknown } | undefined

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      processMouseDown: (e: Event) => processMouseDown(e),
      processMouseMove: (e: Event) => processMouseMove(e),
      processMouseUp: (e: Event) => processMouseUp(e),
      processMouseWheel: (e: Event) => processMouseWheel(e)
    },
    rootGraph: { id: 'root' }
  }
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: (key: string) => settings.get(key)
  })
}))

vi.mock('@/stores/widgetValueStore', () => ({
  useWidgetValueStore: () => ({
    getWidget: () => widgetState
  })
}))

vi.mock('@/lib/litegraph/src/litegraph', async (importOriginal) => {
  const actual = await importOriginal<typeof LitegraphModule>()
  return {
    ...actual,
    resolveNodeRootGraphId: () => 'root'
  }
})

vi.mock('@/lib/litegraph/src/utils/feedback', async (importOriginal) => {
  const actual = await importOriginal<typeof FeedbackModule>()
  return {
    ...actual,
    defineDeprecatedProperty: vi.fn()
  }
})

function resetMocks() {
  vi.clearAllMocks()
  settings.clear()
  settings.set('Comfy.TextareaWidget.Spellcheck', false)
  settings.set('LiteGraph.Pointer.TrackpadGestures', false)
  widgetState = undefined
}

function createNodeMock(): {
  node: LGraphNode
  getInputEl: () => HTMLTextAreaElement
  getWidget: () => TestWidget
  addWidget: ReturnType<typeof vi.fn>
} {
  let capturedEl: HTMLTextAreaElement | undefined
  let capturedWidget: TestWidget | undefined

  const addWidget = vi.fn(
    (
      _type: string,
      _name: string,
      value: string,
      _callback: () => void,
      _options: object
    ) => ({
      value,
      options: {}
    })
  )

  const node = {
    id: 1,
    addWidget,
    addDOMWidget: vi.fn(
      (
        _name: string,
        _type: string,
        el: HTMLTextAreaElement,
        options: TestWidget['options']
      ) => {
        capturedEl = el
        capturedWidget = {
          element: el,
          options,
          value: '',
          callback: vi.fn()
        }
        return capturedWidget
      }
    )
  } as unknown as LGraphNode

  return {
    node,
    getInputEl: () => {
      if (!capturedEl) throw new Error('addDOMWidget was not invoked')
      return capturedEl
    },
    getWidget: () => {
      if (!capturedWidget) throw new Error('addDOMWidget was not invoked')
      return capturedWidget
    },
    addWidget
  }
}

function setScrollMetrics(
  inputEl: HTMLTextAreaElement,
  metrics: { scrollHeight: number; clientHeight: number }
) {
  Object.defineProperties(inputEl, {
    scrollHeight: { configurable: true, value: metrics.scrollHeight },
    clientHeight: { configurable: true, value: metrics.clientHeight }
  })
}

function dispatchWheel(
  inputEl: HTMLTextAreaElement,
  init: WheelEventInit
): WheelEvent {
  const event = new WheelEvent('wheel', {
    bubbles: true,
    cancelable: true,
    ...init
  })
  inputEl.dispatchEvent(event)
  return event
}

function expectWheelForwarded(event: WheelEvent) {
  expect(event.defaultPrevented).toBe(true)
  expect(processMouseWheel).toHaveBeenCalledTimes(1)
}

const multilineInputSpec: InputSpec = {
  type: 'STRING',
  name: 'text',
  multiline: true,
  default: ''
} as InputSpec

describe('useStringWidget', () => {
  beforeEach(resetMocks)

  it('creates a single-line text widget for non-multiline inputs', () => {
    const { node, addWidget } = createNodeMock()

    const widget = useStringWidget()(node, {
      type: 'STRING',
      name: 'text',
      default: 'hello'
    } as InputSpec)

    expect(addWidget).toHaveBeenCalledWith(
      'text',
      'text',
      'hello',
      expect.any(Function),
      {}
    )
    expect(widget.value).toBe('hello')
  })

  it('copies dynamic prompt metadata when present', () => {
    const { node } = createNodeMock()

    const widget = useStringWidget()(node, {
      type: 'STRING',
      name: 'text',
      default: 'hello',
      dynamicPrompts: true
    } as InputSpec)

    expect(widget.dynamicPrompts).toBe(true)
  })

  it('throws for non-string input specs', () => {
    const { node } = createNodeMock()

    expect(() =>
      useStringWidget()(node, {
        type: 'INT',
        name: 'text'
      } as InputSpec)
    ).toThrow('Invalid input data')
  })

  it('syncs multiline DOM widget value with widget state when available', () => {
    widgetState = { value: 'stored' }
    const { node, getInputEl, getWidget } = createNodeMock()

    useStringWidget()(node, multilineInputSpec)
    const inputEl = getInputEl()
    const widget = getWidget()

    expect(widget.options.getValue?.()).toBe('stored')

    widget.options.setValue?.('updated')

    expect(inputEl.value).toBe('updated')
    expect(widgetState.value).toBe('updated')
  })

  it('falls back to textarea value when no widget state exists', () => {
    const { node, getInputEl, getWidget } = createNodeMock()

    useStringWidget()(node, multilineInputSpec)
    const inputEl = getInputEl()
    const widget = getWidget()
    inputEl.value = 'typed'

    expect(widget.options.getValue?.()).toBe('typed')
  })

  it('updates widget value and invokes callback on textarea input', () => {
    const { node, getInputEl, getWidget } = createNodeMock()

    useStringWidget()(node, multilineInputSpec)
    const inputEl = getInputEl()
    const widget = getWidget()
    inputEl.value = 'typed'
    inputEl.dispatchEvent(new InputEvent('input', { bubbles: true }))

    expect(widget.value).toBe('typed')
    expect(widget.callback).toHaveBeenCalledWith('typed')
  })
})

describe('useStringWidget wheel handling', () => {
  let inputEl: HTMLTextAreaElement

  beforeEach(() => {
    resetMocks()
    const { node, getInputEl } = createNodeMock()
    useStringWidget()(node, multilineInputSpec)
    inputEl = getInputEl()
    setScrollMetrics(inputEl, { scrollHeight: 100, clientHeight: 100 })
  })

  it('forwards ctrl-wheel pinch gestures to the canvas', () => {
    const event = dispatchWheel(inputEl, { ctrlKey: true, deltaY: 10 })

    expectWheelForwarded(event)
  })

  it('forwards likely trackpad gestures when trackpad gestures are enabled', () => {
    settings.set('LiteGraph.Pointer.TrackpadGestures', true)

    const event = dispatchWheel(inputEl, { deltaY: 10 })

    expectWheelForwarded(event)
  })

  it('forwards horizontal wheel gestures to the canvas', () => {
    const event = dispatchWheel(inputEl, { deltaX: 120, deltaY: 10 })

    expectWheelForwarded(event)
  })

  it('keeps vertical wheel events inside a scrollable textarea', () => {
    setScrollMetrics(inputEl, { scrollHeight: 200, clientHeight: 100 })

    const event = dispatchWheel(inputEl, { deltaY: 120 })

    expect(event.defaultPrevented).toBe(false)
    expect(processMouseWheel).not.toHaveBeenCalled()
  })

  it('forwards vertical wheel events when the textarea cannot scroll', () => {
    const event = dispatchWheel(inputEl, { deltaY: 120 })

    expectWheelForwarded(event)
  })
})

describe('useStringWidget multiline pointer handlers', () => {
  let inputEl: HTMLTextAreaElement

  beforeEach(() => {
    resetMocks()
    const { node, getInputEl } = createNodeMock()
    useStringWidget()(node, multilineInputSpec)
    inputEl = getInputEl()
  })

  describe('pointerdown', () => {
    it('forwards middle-button pointerdown to canvas', () => {
      inputEl.dispatchEvent(new PointerEvent('pointerdown', { button: 1 }))
      expect(processMouseDown).toHaveBeenCalledTimes(1)
    })

    it('ignores left-button pointerdown', () => {
      inputEl.dispatchEvent(new PointerEvent('pointerdown', { button: 0 }))
      expect(processMouseDown).not.toHaveBeenCalled()
    })

    it('ignores right-button pointerdown', () => {
      inputEl.dispatchEvent(new PointerEvent('pointerdown', { button: 2 }))
      expect(processMouseDown).not.toHaveBeenCalled()
    })

    it('ignores left-click pointerdown even when middle is incidentally held', () => {
      inputEl.dispatchEvent(
        new PointerEvent('pointerdown', { button: 0, buttons: 5 })
      )
      expect(processMouseDown).not.toHaveBeenCalled()
    })
  })

  describe('pointermove', () => {
    it('forwards pointermove while middle is the only held button', () => {
      inputEl.dispatchEvent(new PointerEvent('pointermove', { buttons: 4 }))
      expect(processMouseMove).toHaveBeenCalledTimes(1)
    })

    it('forwards pointermove when middle is held chorded with left', () => {
      inputEl.dispatchEvent(new PointerEvent('pointermove', { buttons: 5 }))
      expect(processMouseMove).toHaveBeenCalledTimes(1)
    })

    it('forwards pointermove when middle is held chorded with right', () => {
      inputEl.dispatchEvent(new PointerEvent('pointermove', { buttons: 6 }))
      expect(processMouseMove).toHaveBeenCalledTimes(1)
    })

    it('ignores pointermove when middle is not held', () => {
      inputEl.dispatchEvent(new PointerEvent('pointermove', { buttons: 1 }))
      expect(processMouseMove).not.toHaveBeenCalled()
    })

    it('ignores pointermove with no buttons held', () => {
      inputEl.dispatchEvent(new PointerEvent('pointermove', { buttons: 0 }))
      expect(processMouseMove).not.toHaveBeenCalled()
    })
  })

  describe('pointerup', () => {
    it('forwards middle-button pointerup to canvas', () => {
      inputEl.dispatchEvent(new PointerEvent('pointerup', { button: 1 }))
      expect(processMouseUp).toHaveBeenCalledTimes(1)
    })

    it('ignores left-button pointerup', () => {
      inputEl.dispatchEvent(new PointerEvent('pointerup', { button: 0 }))
      expect(processMouseUp).not.toHaveBeenCalled()
    })

    it('ignores right-button pointerup', () => {
      inputEl.dispatchEvent(new PointerEvent('pointerup', { button: 2 }))
      expect(processMouseUp).not.toHaveBeenCalled()
    })
  })
})
