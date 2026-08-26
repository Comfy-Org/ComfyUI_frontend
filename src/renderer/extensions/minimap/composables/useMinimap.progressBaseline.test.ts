import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, shallowRef } from 'vue'

import type { LGraphEventMap } from '@/lib/litegraph/src/infrastructure/LGraphEventMap'
import { CustomEventTarget } from '@/lib/litegraph/src/infrastructure/CustomEventTarget'
import type { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { MinimapDataSource } from '@/renderer/extensions/minimap/data/MinimapDataSource'
import type { NodeProgressState } from '@/schemas/apiSchema'
import { createMockCanvas2DContext } from '@/utils/__tests__/litegraphTestUtils'

interface HarnessCounters {
  digestNodeReads: number
  linkDigestReads: number
  dataNodeReads: number
  topologyReads: number
  boundsReads: number
  executionColorUpdates: number
  canvasRedraws: number
  dirtyRequests: number
  pollRegistrations: number
  pollCallbacks: number
  throttleRequests: number
  throttleCallbacks: number
  listenersAdded: number
  listenersRemoved: number
  pollPauses: number
  pollResumes: number
}

const {
  counters,
  defaultSettingStore,
  mockCanvasStore,
  progressStates,
  apiListeners,
  pollControl
} = vi.hoisted(() => {
  const counters: HarnessCounters = {
    digestNodeReads: 0,
    linkDigestReads: 0,
    dataNodeReads: 0,
    topologyReads: 0,
    boundsReads: 0,
    executionColorUpdates: 0,
    canvasRedraws: 0,
    dirtyRequests: 0,
    pollRegistrations: 0,
    pollCallbacks: 0,
    throttleRequests: 0,
    throttleCallbacks: 0,
    listenersAdded: 0,
    listenersRemoved: 0,
    pollPauses: 0,
    pollResumes: 0
  }
  return {
    counters,
    defaultSettingStore: {
      visible: true,
      get: vi.fn(() => true),
      set: vi.fn().mockResolvedValue(undefined)
    },
    mockCanvasStore: { canvas: null as unknown },
    progressStates: {} as Record<string, NodeProgressState>,
    apiListeners: new Map<string, EventListener>(),
    pollControl: { current: undefined as (() => void) | undefined }
  }
})

vi.mock('@vueuse/core', () => ({
  useDocumentVisibility: () => ({ value: 'visible' }),
  useIntervalFn: (callback: () => void) => {
    counters.pollRegistrations++
    // The callback is driven explicitly so WS fanout and 100 ms poll cadence
    // remain separate deterministic axes in this baseline.
    pollControl.current = () => {
      counters.pollCallbacks++
      callback()
    }
    return {
      pause: () => counters.pollPauses++,
      resume: () => counters.pollResumes++
    }
  },
  useRafFn: () => ({
    pause: vi.fn(),
    resume: vi.fn()
  }),
  useThrottleFn: (callback: () => void) => () => {
    counters.throttleRequests++
    counters.throttleCallbacks++
    callback()
  }
}))

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({
    get: () => defaultSettingStore.visible,
    set: defaultSettingStore.set
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({ activeSubgraph: null })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => mockCanvasStore
}))

vi.mock('@/stores/executionStore', () => ({
  useExecutionStore: () => ({
    nodeProgressStates: progressStates,
    nodeLocationProgressStates: progressStates
  })
}))

vi.mock('@/stores/linkStore', () => ({
  useLinkStore: () => ({
    graphTopologies: () => {
      counters.topologyReads++
      return []
    }
  })
}))

vi.mock('@/stores/workspace/colorPaletteStore', () => ({
  useColorPaletteStore: () => ({
    completedActivePalette: { light_theme: false }
  })
}))

vi.mock('@/scripts/api', () => ({
  api: {
    addEventListener: (name: string, listener: EventListener) => {
      counters.listenersAdded++
      apiListeners.set(name, listener)
    },
    removeEventListener: (name: string) => {
      counters.listenersRemoved++
      apiListeners.delete(name)
    },
    apiURL: (path: string) => path
  }
}))

vi.mock('@/scripts/app', () => ({
  app: { canvas: null }
}))

import { useMinimap } from '@/renderer/extensions/minimap/composables/useMinimap'

type Operation = 'equal-progress' | 'changed-progress' | 'geometry' | 'topology'

interface MatrixResult extends HarnessCounters {
  visible: boolean
  graphSize: number
  operation: Operation
}

function resetCounters() {
  for (const key of Object.keys(counters) as Array<keyof HarnessCounters>) {
    counters[key] = 0
  }
}

function instrumentedNode(index: number): LGraphNode {
  const position: [number, number] = [index * 20, index * 10]
  const size: [number, number] = [100, 50]
  return {
    id: String(index),
    get pos() {
      counters.digestNodeReads++
      return position
    },
    set pos(value: [number, number]) {
      position[0] = value[0]
      position[1] = value[1]
    },
    get renderingSize() {
      return size
    },
    size,
    mode: 0,
    outputs: []
  } as unknown as LGraphNode
}

function createGraph(graphSize: number) {
  const nodes = Array.from({ length: graphSize }, (_, index) =>
    instrumentedNode(index + 1)
  )
  const links = new Map()
  const originalValues = links.values.bind(links)
  links.values = () => {
    counters.linkDigestReads++
    return originalValues()
  }

  return {
    graph: {
      id: 'root',
      rootGraph: { id: 'root' },
      _nodes: nodes,
      _groups: [],
      links,
      isRootGraph: true,
      events: new CustomEventTarget<LGraphEventMap>(),
      onConnectionChange: null,
      getNodeById: (id: string) => nodes.find((node) => node.id === id),
      setDirtyCanvas: () => counters.dirtyRequests++
    } as unknown as LGraph,
    nodes
  }
}

async function runCell(
  visible: boolean,
  graphSize: number,
  operation: Operation
): Promise<MatrixResult> {
  resetCounters()
  apiListeners.clear()
  for (const key of Object.keys(progressStates)) delete progressStates[key]
  progressStates['1'] = {
    state: 'running',
    value: 1,
    max: 2,
    node_id: '1',
    prompt_id: 'prompt-1'
  }

  const { graph, nodes } = createGraph(graphSize)
  const context = createMockCanvas2DContext()
  vi.mocked(context.clearRect).mockImplementation(() => {
    counters.canvasRedraws++
  })
  vi.mocked(context.strokeRect).mockImplementation(() => {
    counters.executionColorUpdates++
  })
  const canvasElement = {
    width: 250,
    height: 200,
    getContext: (kind: string) => (kind === '2d' ? context : null)
  } as unknown as HTMLCanvasElement
  mockCanvasStore.canvas = {
    graph,
    canvas: {
      width: 1000,
      height: 800,
      clientWidth: 1000,
      clientHeight: 800
    },
    ds: { scale: 1, offset: [0, 0] },
    setDirty: () => counters.dirtyRequests++
  }
  defaultSettingStore.visible = visible

  const getNodes = vi.spyOn(MinimapDataSource.prototype, 'getNodes')
  const getLinks = vi.spyOn(MinimapDataSource.prototype, 'getLinks')
  const getBounds = vi.spyOn(MinimapDataSource.prototype, 'getBounds')
  const minimap = useMinimap({
    canvasRefMaybe: shallowRef(canvasElement),
    containerRefMaybe: shallowRef({
      getBoundingClientRect: () => new DOMRect(0, 0, 250, 200)
    } as HTMLDivElement)
  })
  await minimap.init()
  await nextTick()
  await nextTick()
  await nextTick()

  // Establish the digest and clear initialization work from the measured arm.
  pollControl.current?.()
  const lifecycleAtInit = {
    pollRegistrations: counters.pollRegistrations,
    listenersAdded: counters.listenersAdded,
    pollPauses: counters.pollPauses,
    pollResumes: counters.pollResumes
  }
  resetCounters()
  getNodes.mockClear()
  getLinks.mockClear()
  getBounds.mockClear()

  if (operation === 'equal-progress') {
    progressStates['1'] = { ...progressStates['1'] }
  } else if (operation === 'changed-progress') {
    progressStates['1'] = {
      ...progressStates['1'],
      state: 'finished'
    }
  } else if (operation === 'geometry') {
    nodes[0].pos = [10_001, 10_001]
  } else {
    const mutableLinks = graph.links as unknown as Map<string, unknown>
    mutableLinks.set('new-link', {
      origin_id: '1',
      target_id: String(Math.min(2, graphSize)),
      origin_slot: 0,
      target_slot: 0
    })
  }

  pollControl.current?.()
  counters.dataNodeReads = getNodes.mock.calls.length
  counters.topologyReads = getLinks.mock.calls.length
  counters.boundsReads = getBounds.mock.calls.length

  const result = {
    visible,
    graphSize,
    operation,
    ...counters
  }
  minimap.destroy()
  result.pollRegistrations = lifecycleAtInit.pollRegistrations
  result.listenersAdded = lifecycleAtInit.listenersAdded
  result.listenersRemoved = counters.listenersRemoved
  result.pollPauses = lifecycleAtInit.pollPauses + counters.pollPauses
  result.pollResumes = lifecycleAtInit.pollResumes
  getNodes.mockRestore()
  getLinks.mockRestore()
  getBounds.mockRestore()
  return result
}

describe('minimap progress performance baseline', () => {
  beforeEach(() => {
    pollControl.current = undefined
  })

  it('records the hidden/visible, graph-size and mutation matrix', async () => {
    const results: MatrixResult[] = []
    for (const visible of [false, true]) {
      for (const graphSize of [1, 245, 1000]) {
        for (const operation of [
          'equal-progress',
          'changed-progress',
          'geometry',
          'topology'
        ] as const) {
          results.push(await runCell(visible, graphSize, operation))
        }
      }
    }

    for (const cell of results.filter((cell) => !cell.visible)) {
      expect(cell.digestNodeReads).toBe(0)
      expect(cell.linkDigestReads).toBe(0)
      expect(cell.canvasRedraws).toBe(0)
      expect(cell.boundsReads).toBe(0)
      expect(cell.topologyReads).toBe(0)
    }

    for (const cell of results.filter((cell) => cell.visible)) {
      const expectedNodeGeometryReads =
        cell.operation === 'equal-progress'
          ? cell.graphSize
          : cell.operation === 'geometry'
            ? cell.graphSize * 5
            : cell.graphSize * 3
      expect(cell.digestNodeReads).toBe(expectedNodeGeometryReads)
      expect(cell.linkDigestReads).toBe(1)
      expect(cell.dirtyRequests).toBe(0)

      if (cell.operation === 'equal-progress') {
        expect(cell.canvasRedraws).toBe(0)
        expect(cell.dataNodeReads).toBe(0)
        expect(cell.boundsReads).toBe(0)
        expect(cell.topologyReads).toBe(0)
      } else {
        expect(cell.canvasRedraws).toBe(1)
        expect(cell.dataNodeReads).toBeGreaterThan(0)
      }

      if (cell.operation === 'changed-progress') {
        expect(cell.boundsReads).toBe(0)
        expect(cell.topologyReads).toBe(1)
        expect(cell.executionColorUpdates).toBe(1)
      } else if (cell.operation === 'geometry') {
        expect(cell.boundsReads).toBe(1)
      } else if (cell.operation === 'topology') {
        expect(cell.boundsReads).toBe(0)
        expect(cell.topologyReads).toBe(1)
      }
    }
  })

  it('separates WS-style event fanout from polling and throttle cadence', async () => {
    const cell = await runCell(true, 245, 'equal-progress')
    // A progress store write has no minimap event subscription. The only work
    // is the independently scheduled digest poll.
    expect(cell.pollCallbacks).toBe(1)
    expect(cell.throttleRequests).toBe(0)
    expect(cell.throttleCallbacks).toBe(0)
    expect(apiListeners.has('progress')).toBe(false)
  })

  it('registers one poll and releases its listener and cadence on cleanup', async () => {
    const cell = await runCell(true, 245, 'equal-progress')
    expect(cell.pollRegistrations).toBe(1)
    expect(cell.listenersAdded).toBe(1)
    expect(cell.listenersRemoved).toBe(1)
    expect(cell.pollResumes).toBe(1)
    expect(cell.pollPauses).toBeGreaterThanOrEqual(1)
  })
})
