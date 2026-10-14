import { fromAny } from '@total-typescript/shoehorn'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { LightInfoViewport } from '@/extensions/core/lightInfo/LightInfoViewport'
import type { LightInfoViewportOptions } from '@/extensions/core/lightInfo/LightInfoViewport'
import { createDefaultLight } from '@/extensions/core/lightInfo/types'
import type { LightInfoEntry } from '@/extensions/core/lightInfo/types'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { toNodeId } from '@/types/nodeId'
import { widgetId } from '@/types/widgetId'
import { createMockLGraphNode } from '@/utils/__tests__/litegraphTestUtils'

import { useLightInfo } from './useLightInfo'

interface FakeViewport {
  options: LightInfoViewportOptions
  applyLights: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
  viewport: {
    updateStatusMouseOnScene: ReturnType<typeof vi.fn>
    updateStatusMouseOnNode: ReturnType<typeof vi.fn>
    refreshViewport: ReturnType<typeof vi.fn>
  }
}

const { viewportInstances } = vi.hoisted(() => ({
  viewportInstances: [] as FakeViewport[]
}))

vi.mock(import('@/extensions/core/lightInfo/LightInfoViewport'), async () => {
  const { fromAny } = await import('@total-typescript/shoehorn')
  return {
    LightInfoViewport: fromAny(
      vi.fn(function (
        this: FakeViewport,
        _container: HTMLElement,
        _lights: LightInfoEntry[],
        options: LightInfoViewportOptions
      ) {
        this.options = options
        this.applyLights = vi.fn()
        this.remove = vi.fn()
        this.viewport = {
          updateStatusMouseOnScene: vi.fn(),
          updateStatusMouseOnNode: vi.fn(),
          refreshViewport: vi.fn()
        }
        viewportInstances.push(this)
      })
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

function mount(initial: LightInfoEntry[]) {
  const { node, editorId } = makeNode(initial)
  const light = useLightInfo(node)
  light.initialize(document.createElement('div'))
  const stored = () => useWidgetValueStore().getWidget(editorId)?.value
  return { node, editorId, light, stored }
}

function onlyViewport(): FakeViewport {
  const [viewport] = viewportInstances
  assert.exists(viewport)
  return viewport
}

const directional: LightInfoEntry = {
  ...createDefaultLight('directional'),
  color: '#ff0000',
  position: { x: 1, y: 2, z: 3 },
  target: { x: 0, y: 1, z: 0 }
}

describe('useLightInfo widget boundary', () => {
  beforeEach(() => {
    viewportInstances.length = 0
  })

  it('reads the initial lights from the widget value store', () => {
    const { light } = mount([createDefaultLight('point')])

    expect(light.lights.value).toHaveLength(1)
    expect(light.selectedLight.value?.type).toBe('point')
  })

  it('follows external store changes to its own widget only', () => {
    const { editorId, light } = mount([createDefaultLight('directional')])
    const otherId = widgetId(GRAPH_ID, toNodeId(7), 'other')
    useWidgetValueStore().registerWidget(otherId, {
      type: 'string',
      value: '',
      options: {}
    })

    useWidgetValueStore().setValue(otherId, 'changed')
    expect(light.lights.value).toHaveLength(1)

    useWidgetValueStore().setValue(editorId, [
      createDefaultLight('point'),
      createDefaultLight('spot')
    ])
    expect(light.lights.value.map((l) => l.type)).toEqual(['point', 'spot'])
    expect(onlyViewport().applyLights).toHaveBeenLastCalledWith(
      expect.arrayContaining([expect.objectContaining({ type: 'spot' })]),
      0
    )
  })

  it.for([
    {
      label: 'clamps the selection when the list shrinks',
      initial: [directional, createDefaultLight('point')],
      select: 1,
      external: [createDefaultLight('spot')],
      expected: 0
    },
    {
      label: 'selects the first light when lights appear',
      initial: [],
      select: -1,
      external: [createDefaultLight('spot')],
      expected: 0
    }
  ])(
    '$label after an external change',
    ({ initial, select, external, expected }) => {
      const { editorId, light } = mount(initial)
      light.selectLight(select)

      useWidgetValueStore().setValue(editorId, external)

      expect(light.selectedIndex.value).toBe(expected)
    }
  )

  it('stops following the store after cleanup', () => {
    const { editorId, light } = mount([])
    light.cleanup()

    useWidgetValueStore().setValue(editorId, [createDefaultLight('point')])

    expect(light.lights.value).toHaveLength(0)
  })

  it('shows an alert and keeps no viewport when the viewport cannot start', () => {
    vi.mocked(LightInfoViewport).mockImplementationOnce(function () {
      throw new Error('WebGL unavailable')
    })
    const { editorId, light } = mount([])

    useWidgetValueStore().setValue(editorId, [createDefaultLight('point')])

    expect(useToast().toasts).toEqual([
      expect.objectContaining({
        kind: 'warning',
        title: 'Failed to initialize Light Info viewer. Try reloading the page.'
      })
    ])
    expect(light.lights.value).toHaveLength(0)
  })
})

describe('useLightInfo editing', () => {
  beforeEach(() => {
    viewportInstances.length = 0
  })

  it('adds a default light, selects it and stores it', () => {
    const { light, stored } = mount([directional])

    light.addLight('spot')

    expect(light.selectedIndex.value).toBe(1)
    expect(stored()).toEqual([directional, createDefaultLight('spot')])
  })

  it('removes the selected light and selects the one before it', () => {
    const point = createDefaultLight('point')
    const { light, stored } = mount([
      directional,
      point,
      createDefaultLight('spot')
    ])
    light.selectLight(2)

    light.removeSelectedLight()

    expect(light.selectedIndex.value).toBe(1)
    expect(stored()).toEqual([directional, point])
  })

  it('normalizes a patch before storing it', () => {
    const { light, stored } = mount([directional])

    light.updateSelectedLight({ intensity: -3, color: '#00ff00' })

    expect(stored()).toEqual([
      { ...directional, intensity: 0, color: '#00ff00' }
    ])
  })

  it.for([
    {
      type: 'point',
      expected: {
        ...createDefaultLight('point'),
        color: '#ff0000',
        position: { x: 1, y: 2, z: 3 }
      }
    },
    {
      type: 'spot',
      expected: {
        ...createDefaultLight('spot'),
        color: '#ff0000',
        position: { x: 1, y: 2, z: 3 },
        target: { x: 0, y: 1, z: 0 }
      }
    }
  ] as const)(
    'switches a directional light to $type keeping its color, position and aim',
    ({ type, expected }) => {
      const { light, stored } = mount([directional])

      light.setSelectedLightType(type)

      expect(stored()).toEqual([expected])
    }
  )

  it.for([
    { label: 'past the end', index: 5 },
    { label: 'negative', index: -1 }
  ])('ignores selecting a $label index', ({ index }) => {
    const { light } = mount([directional])

    light.selectLight(index)

    expect(light.selectedIndex.value).toBe(0)
  })

  it('stores lights edited by dragging in the viewport', () => {
    const { light, stored } = mount([directional])
    const moved = { ...directional, position: { x: 5, y: 5, z: 5 } }

    onlyViewport().options.onLightsChange?.([moved])

    expect(light.lights.value).toEqual([moved])
    expect(stored()).toEqual([moved])
  })

  it('selects a light picked in the viewport', () => {
    const { light } = mount([directional, createDefaultLight('point')])

    onlyViewport().options.onSelectLight?.(1)

    expect(light.selectedLight.value?.type).toBe('point')
  })
})

describe('useLightInfo hover tracking', () => {
  beforeEach(() => {
    viewportInstances.length = 0
  })

  it.for([
    { trigger: 'node enter', method: 'updateStatusMouseOnNode', value: true },
    { trigger: 'node leave', method: 'updateStatusMouseOnNode', value: false },
    { trigger: 'scene enter', method: 'updateStatusMouseOnScene', value: true },
    { trigger: 'scene leave', method: 'updateStatusMouseOnScene', value: false }
  ] as const)(
    'tells the viewport about a $trigger',
    ({ trigger, method, value }) => {
      const { node, light } = mount([])
      const actions = {
        'node enter': () => node.onMouseEnter?.(fromAny({})),
        'node leave': () => node.onMouseLeave?.(fromAny({})),
        'scene enter': light.handleMouseEnter,
        'scene leave': light.handleMouseLeave
      }

      actions[trigger]()

      expect(onlyViewport().viewport[method]).toHaveBeenCalledWith(value)
    }
  )

  it('restores the node mouse handlers on cleanup without stacking wrappers', () => {
    const { node } = makeNode([])
    const originalEnter = vi.fn()
    node.onMouseEnter = originalEnter
    const light = useLightInfo(node)

    light.initialize(document.createElement('div'))
    light.initialize(document.createElement('div'))
    node.onMouseEnter(fromAny({}))
    expect(originalEnter).toHaveBeenCalledOnce()

    light.cleanup()
    expect(node.onMouseEnter).toBe(originalEnter)
  })
})
