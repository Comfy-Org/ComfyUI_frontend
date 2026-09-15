import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LightInfoViewport } from '@/extensions/core/lightInfo/LightInfoViewport'
import { createDefaultLight } from '@/extensions/core/lightInfo/types'
import type { LightInfoEntry } from '@/extensions/core/lightInfo/types'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import { useLightInfo } from './useLightInfo'

const { viewportInstances } = vi.hoisted(() => ({
  viewportInstances: [] as Array<{ applyLights: ReturnType<typeof vi.fn> }>
}))

vi.mock(import('@/extensions/core/lightInfo/LightInfoViewport'), async () => {
  const { fromPartial } = await import('@total-typescript/shoehorn')
  return {
    LightInfoViewport: fromPartial<typeof LightInfoViewport>(
      class MockViewport {
        applyLights = vi.fn()
        remove = vi.fn()
        viewport = {
          updateStatusMouseOnScene: vi.fn(),
          updateStatusMouseOnNode: vi.fn(),
          refreshViewport: vi.fn()
        }
        constructor() {
          viewportInstances.push(this)
        }
      }
    )
  }
})

const GRAPH_ID = 'light-info-test'
const EDITOR_WIDGET = 'editor_state'

function makeNode(initial: LightInfoEntry[]): {
  node: LGraphNode
  editorId: ReturnType<typeof widgetId>
} {
  const id = toNodeId(7)
  const editorId = widgetId(GRAPH_ID, id, EDITOR_WIDGET)
  useWidgetValueStore().registerWidget(editorId, {
    type: 'lightinfo',
    value: initial,
    options: {}
  })
  const node = createMockLGraphNode({
    id,
    graph: { rootGraph: { id: GRAPH_ID } }
  })
  return { node, editorId }
}

describe('useLightInfo widget boundary', () => {
  beforeEach(() => {
    viewportInstances.length = 0
  })

  it('reads the initial lights from the widget value store', () => {
    const { node } = makeNode([createDefaultLight('point')])
    const light = useLightInfo(node)

    light.initialize(document.createElement('div'))

    expect(light.lights.value).toHaveLength(1)
    expect(light.selectedLight.value?.type).toBe('point')
  })

  it('writes edits into the widget value store', () => {
    const { node, editorId } = makeNode([])
    const light = useLightInfo(node)
    light.initialize(document.createElement('div'))

    light.addLight('spot')

    const stored = useWidgetValueStore().getWidget(editorId)?.value
    expect(stored).toEqual([expect.objectContaining({ type: 'spot' })])
  })

  it('follows external store changes to its own widget only', () => {
    const { node, editorId } = makeNode([createDefaultLight('directional')])
    const otherId = widgetId(GRAPH_ID, toNodeId(7), 'other')
    useWidgetValueStore().registerWidget(otherId, {
      type: 'string',
      value: '',
      options: {}
    })
    const light = useLightInfo(node)
    light.initialize(document.createElement('div'))

    useWidgetValueStore().setValue(otherId, 'changed')
    expect(light.lights.value).toHaveLength(1)

    useWidgetValueStore().setValue(editorId, [
      createDefaultLight('point'),
      createDefaultLight('spot')
    ])
    expect(light.lights.value.map((l) => l.type)).toEqual(['point', 'spot'])
    expect(viewportInstances[0].applyLights).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ type: 'spot' })]),
      0
    )
  })

  it('stops following the store after cleanup', () => {
    const { node, editorId } = makeNode([])
    const light = useLightInfo(node)
    light.initialize(document.createElement('div'))
    light.cleanup()

    useWidgetValueStore().setValue(editorId, [createDefaultLight('point')])

    expect(light.lights.value).toHaveLength(0)
  })
})
