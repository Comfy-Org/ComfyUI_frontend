import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type * as Litegraph from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { useStringWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useStringWidget'
import { createMockDOMWidgetNode } from '@/renderer/extensions/vueNodes/widgets/composables/__tests__/domWidgetTestUtils'

const { canvasMock } = vi.hoisted(() => ({
  canvasMock: {
    processMouseDown: vi.fn(),
    processMouseMove: vi.fn(),
    processMouseUp: vi.fn(),
    processMouseWheel: vi.fn()
  }
}))

vi.mock('@/scripts/app', () => ({
  app: { rootGraph: { id: 'root' }, canvas: canvasMock }
}))
vi.mock('@/lib/litegraph/src/litegraph', async (importOriginal) => {
  const actual = await importOriginal<typeof Litegraph>()
  return { ...actual, resolveNodeRootGraphId: vi.fn(() => 'root') }
})
vi.mock('@/stores/widgetValueStore', () => ({
  useWidgetValueStore: () => ({ getWidget: () => undefined })
}))
vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: () => false })
}))

function createStringWidget(node: LGraphNode) {
  const inputSpec: InputSpec = {
    type: 'STRING',
    name: 'prompt',
    default: '',
    multiline: true
  }
  return useStringWidget()(node, inputSpec) as ReturnType<
    ReturnType<typeof useStringWidget>
  > & { element: HTMLTextAreaElement }
}

describe('useStringWidget (multiline)', () => {
  let widget: ReturnType<typeof createStringWidget>
  let inputEl: HTMLTextAreaElement
  let callback: ReturnType<typeof vi.fn<(value: string) => void>>

  beforeEach(() => {
    vi.clearAllMocks()
    const node = createMockDOMWidgetNode()
    widget = createStringWidget(node)
    callback = vi.fn<(value: string) => void>()
    widget.callback = callback
    inputEl = widget.element
    document.body.append(inputEl)
  })

  afterEach(() => inputEl.remove())

  it('fires the widget callback on input', () => {
    inputEl.value = 'hello'
    inputEl.dispatchEvent(new Event('input', { bubbles: true }))
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('forwards middle-click pointer events and ctrl+wheel to the canvas while alive', () => {
    inputEl.dispatchEvent(new PointerEvent('pointerdown', { button: 1 }))
    inputEl.dispatchEvent(new PointerEvent('pointermove', { buttons: 4 }))
    inputEl.dispatchEvent(new PointerEvent('pointerup', { button: 1 }))
    inputEl.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true }))

    expect(canvasMock.processMouseDown).toHaveBeenCalledTimes(1)
    expect(canvasMock.processMouseMove).toHaveBeenCalledTimes(1)
    expect(canvasMock.processMouseUp).toHaveBeenCalledTimes(1)
    expect(canvasMock.processMouseWheel).toHaveBeenCalledTimes(1)
  })

  it('detaches every listener when the widget is removed', () => {
    widget.onRemove?.()

    inputEl.value = 'after'
    inputEl.dispatchEvent(new Event('input', { bubbles: true }))
    inputEl.dispatchEvent(new PointerEvent('pointerdown', { button: 1 }))
    inputEl.dispatchEvent(new PointerEvent('pointermove', { buttons: 4 }))
    inputEl.dispatchEvent(new PointerEvent('pointerup', { button: 1 }))
    inputEl.dispatchEvent(new WheelEvent('wheel', { ctrlKey: true }))

    expect(callback).not.toHaveBeenCalled()
    expect(canvasMock.processMouseDown).not.toHaveBeenCalled()
    expect(canvasMock.processMouseMove).not.toHaveBeenCalled()
    expect(canvasMock.processMouseUp).not.toHaveBeenCalled()
    expect(canvasMock.processMouseWheel).not.toHaveBeenCalled()
  })
})
