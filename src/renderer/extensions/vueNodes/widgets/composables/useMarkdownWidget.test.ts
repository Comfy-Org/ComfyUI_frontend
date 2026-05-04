import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as LitegraphModule from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useMarkdownWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useMarkdownWidget'

type TestWidget = {
  element: HTMLElement
  options: {
    getValue?: () => string
    setValue?: (value: string) => void
    minNodeSize?: [number, number]
  }
  value: string
  callback: ReturnType<typeof vi.fn>
}

const processMouseDown = vi.fn()
const processMouseMove = vi.fn()
const processMouseUp = vi.fn()
let widgetState: { value: unknown } | undefined

vi.mock('@/scripts/app', () => ({
  app: {
    canvas: {
      processMouseDown: (e: Event) => processMouseDown(e),
      processMouseMove: (e: Event) => processMouseMove(e),
      processMouseUp: (e: Event) => processMouseUp(e)
    },
    rootGraph: { id: 'root' }
  }
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

function resetMocks() {
  vi.clearAllMocks()
  widgetState = undefined
}

function createNodeMock(): {
  node: LGraphNode
  getInputEl: () => HTMLElement
  getTextarea: () => HTMLTextAreaElement
  getWidget: () => TestWidget
} {
  let capturedEl: HTMLElement | undefined
  let capturedWidget: TestWidget | undefined

  const node = {
    id: 1,
    addDOMWidget: vi.fn(
      (
        _name: string,
        _type: string,
        el: HTMLElement,
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
    getTextarea: () => {
      const textarea = capturedEl?.querySelector('textarea')
      if (!(textarea instanceof HTMLTextAreaElement)) {
        throw new Error('Markdown textarea was not created')
      }
      return textarea
    },
    getWidget: () => {
      if (!capturedWidget) throw new Error('addDOMWidget was not invoked')
      return capturedWidget
    }
  }
}

const markdownInputSpec: InputSpec = {
  type: 'STRING',
  name: 'text',
  default: ''
} as InputSpec

describe('useMarkdownWidget', () => {
  beforeEach(resetMocks)

  it('syncs DOM widget value with widget state when available', () => {
    widgetState = { value: 'stored' }
    const { node, getTextarea, getWidget } = createNodeMock()

    useMarkdownWidget()(node, markdownInputSpec)
    const textarea = getTextarea()
    const widget = getWidget()

    expect(widget.options.getValue?.()).toBe('stored')

    widget.options.setValue?.('updated')

    expect(textarea.value).toBe('updated')
    expect(widgetState.value).toBe('updated')
  })

  it('falls back to textarea value when no widget state exists', () => {
    const { node, getTextarea, getWidget } = createNodeMock()

    useMarkdownWidget()(node, markdownInputSpec)
    const textarea = getTextarea()
    const widget = getWidget()
    textarea.value = 'typed'

    expect(widget.options.getValue?.()).toBe('typed')
  })

  it('updates widget value and invokes callback on markdown input', () => {
    const { node, getTextarea, getWidget } = createNodeMock()

    useMarkdownWidget()(node, markdownInputSpec)
    const textarea = getTextarea()
    const widget = getWidget()
    textarea.value = 'typed'
    textarea.dispatchEvent(
      new InputEvent('input', { bubbles: true, inputType: 'insertText' })
    )

    expect(widget.value).toBe('typed')
    expect(widget.callback).toHaveBeenCalledWith('typed')
  })

  it('toggles editing state around double-click and blur', () => {
    vi.useFakeTimers()
    const { node, getInputEl, getTextarea } = createNodeMock()

    try {
      useMarkdownWidget()(node, markdownInputSpec)
      const inputEl = getInputEl()
      const textarea = getTextarea()
      const focusSpy = vi.spyOn(textarea, 'focus')

      inputEl.dispatchEvent(new MouseEvent('dblclick'))
      vi.runAllTimers()

      expect(inputEl.classList.contains('editing')).toBe(true)
      expect(focusSpy).toHaveBeenCalled()

      textarea.dispatchEvent(new FocusEvent('blur'))

      expect(inputEl.classList.contains('editing')).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('updates rendered content and invokes callback on textarea change', () => {
    const { node, getTextarea, getWidget } = createNodeMock()

    useMarkdownWidget()(node, markdownInputSpec)
    const textarea = getTextarea()
    const widget = getWidget()
    textarea.value = '# heading'
    textarea.dispatchEvent(new Event('change'))

    expect(widget.callback).toHaveBeenCalledWith(widget.value)
  })

  it('stops keydown events inside the markdown widget', () => {
    const { node, getInputEl } = createNodeMock()

    useMarkdownWidget()(node, markdownInputSpec)
    const inputEl = getInputEl()
    const event = new KeyboardEvent('keydown', { bubbles: true })
    const stopPropagationSpy = vi.spyOn(event, 'stopPropagation')
    inputEl.dispatchEvent(event)

    expect(stopPropagationSpy).toHaveBeenCalled()
  })
})

describe('useMarkdownWidget pointer handlers', () => {
  let inputEl: HTMLElement

  beforeEach(() => {
    resetMocks()
    const { node, getInputEl } = createNodeMock()
    useMarkdownWidget()(node, markdownInputSpec)
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

    it('ignores left-click pointerdown when middle is incidentally held', () => {
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
