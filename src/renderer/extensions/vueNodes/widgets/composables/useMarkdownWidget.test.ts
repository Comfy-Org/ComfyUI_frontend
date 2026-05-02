import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as LitegraphModule from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useMarkdownWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useMarkdownWidget'

const processMouseDown = vi.fn()
const processMouseMove = vi.fn()
const processMouseUp = vi.fn()

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

function createNodeMock(): {
  node: LGraphNode
  getInputEl: () => HTMLElement
} {
  let capturedEl: HTMLElement | undefined

  const node = {
    id: 1,
    addDOMWidget: vi.fn((_name: string, _type: string, el: HTMLElement) => {
      capturedEl = el
      return {
        element: el,
        options: {},
        value: '',
        callback: vi.fn()
      }
    })
  } as unknown as LGraphNode

  return {
    node,
    getInputEl: () => {
      if (!capturedEl) throw new Error('addDOMWidget was not invoked')
      return capturedEl
    }
  }
}

const markdownInputSpec: InputSpec = {
  type: 'STRING',
  name: 'text',
  default: ''
} as InputSpec

describe('useMarkdownWidget pointer handlers', () => {
  let inputEl: HTMLElement

  beforeEach(() => {
    vi.clearAllMocks()
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
