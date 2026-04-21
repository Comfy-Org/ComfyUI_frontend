import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as LitegraphModule from '@/lib/litegraph/src/litegraph'
import type * as FeedbackModule from '@/lib/litegraph/src/utils/feedback'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useStringWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useStringWidget'

// Capture the inputEl the widget attaches listeners to, so tests can dispatch
// synthetic pointer events directly on it without mounting into the real DOM.
const processMouseDown = vi.fn()
const processMouseMove = vi.fn()
const processMouseUp = vi.fn()
const processMouseWheel = vi.fn()

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
    get: (key: string) => {
      if (key === 'Comfy.TextareaWidget.Spellcheck') return false
      if (key === 'LiteGraph.Pointer.TrackpadGestures') return false
      return undefined
    }
  })
}))

vi.mock('@/stores/widgetValueStore', () => ({
  useWidgetValueStore: () => ({
    getWidget: () => undefined
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

function createNodeMock(): {
  node: LGraphNode
  getInputEl: () => HTMLTextAreaElement
} {
  let capturedEl: HTMLTextAreaElement | undefined

  const node = {
    id: 1,
    addDOMWidget: vi.fn(
      (_name: string, _type: string, el: HTMLTextAreaElement) => {
        capturedEl = el
        return {
          element: el,
          options: {},
          value: '',
          callback: vi.fn()
        }
      }
    )
  } as unknown as LGraphNode

  return {
    node,
    getInputEl: () => {
      if (!capturedEl) throw new Error('addDOMWidget was not invoked')
      return capturedEl
    }
  }
}

const multilineInputSpec: InputSpec = {
  type: 'STRING',
  name: 'text',
  multiline: true,
  default: ''
} as InputSpec

describe('useStringWidget multiline pointer handlers', () => {
  let inputEl: HTMLTextAreaElement

  beforeEach(() => {
    vi.clearAllMocks()
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
      // Chorded pointerdown — user left-clicks while middle is held. The
      // strict semantics in isMiddlePointerInput are what prevents this from
      // being misclassified as a middle-button event.
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
