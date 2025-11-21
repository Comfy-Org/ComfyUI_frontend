import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { ensureCorrectLayoutScale } from '../src/renderer/extensions/vueNodes/layout/ensureCorrectLayoutScale'
import type { LGraph, RendererType } from '../src/lib/litegraph/src/LGraph'
import { LiteGraph } from '../src/lib/litegraph/src/litegraph'

// Mock dependencies
vi.mock('../src/composables/useVueFeatureFlags', () => ({
  useVueFeatureFlags: vi.fn()
}))

vi.mock('../src/platform/settings/settingStore', () => ({
  useSettingStore: vi.fn()
}))

vi.mock('../src/stores/layoutStore', () => ({
  layoutStore: {
    batchUpdateNodeBounds: vi.fn()
  }
}))

vi.mock('../src/stores/layoutMutations', () => ({
  useLayoutMutations: vi.fn()
}))

vi.mock('../src/scripts/app', () => ({
  comfyApp: {
    canvas: null
  }
}))

vi.mock('../src/lib/litegraph/src/measure', () => ({
  createBounds: vi.fn()
}))

import { useVueFeatureFlags } from '../src/composables/useVueFeatureFlags'
import { useSettingStore } from '../src/platform/settings/settingStore'
import { layoutStore } from '../src/stores/layoutStore'
import { useLayoutMutations } from '../src/stores/layoutMutations'
import { comfyApp } from '../src/scripts/app'
import { createBounds } from '../src/lib/litegraph/src/measure'

describe('ensureCorrectLayoutScale', () => {
  let mockGraph: LGraph
  let mockCanvas: any
  let mockSettingStore: any
  let mockLayoutMutations: any

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks()

    // Create a complete mock graph with all required properties
    mockGraph = {
      nodes: [],
      reroutes: new Map(),
      groups: [],
      extra: {
        workflowRendererVersion: undefined
      },
      inputNode: null,
      outputNode: null
    } as any

    // Mock canvas
    mockCanvas = {
      graph: mockGraph,
      ds: {
        scale: 1.0,
        convertOffsetToCanvas: vi.fn((pos) => pos),
        changeScale: vi.fn()
      }
    }

    // Mock setting store
    mockSettingStore = {
      get: vi.fn().mockReturnValue(true)
    }
    vi.mocked(useSettingStore).mockReturnValue(mockSettingStore)

    // Mock layout mutations
    mockLayoutMutations = {
      moveReroute: vi.fn()
    }
    vi.mocked(useLayoutMutations).mockReturnValue(mockLayoutMutations)

    // Mock Vue feature flags
    vi.mocked(useVueFeatureFlags).mockReturnValue({
      shouldRenderVueNodes: { value: false }
    } as any)

    // Set comfyApp canvas
    ;(comfyApp as any).canvas = mockCanvas

    // Mock createBounds
    vi.mocked(createBounds).mockReturnValue([0, 0, 100, 100])
  })

  afterEach(() => {
    ;(comfyApp as any).canvas = null
  })

  describe('autoScaleLayoutSetting disabled', () => {
    it('should return early when autoScaleLayoutSetting is false', () => {
      mockSettingStore.get.mockReturnValue(false)

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(createBounds).not.toHaveBeenCalled()
      expect(mockGraph.extra.workflowRendererVersion).toBeUndefined()
    })

    it('should return early when autoScaleLayoutSetting is undefined', () => {
      mockSettingStore.get.mockReturnValue(undefined)

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(createBounds).not.toHaveBeenCalled()
    })

    it('should return early when autoScaleLayoutSetting is null', () => {
      mockSettingStore.get.mockReturnValue(null)

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(createBounds).not.toHaveBeenCalled()
    })
  })

  describe('invalid graph scenarios', () => {
    it('should return early when graph is null', () => {
      ensureCorrectLayoutScale('LG', null as any)

      expect(createBounds).not.toHaveBeenCalled()
    })

    it('should return early when graph is undefined', () => {
      ensureCorrectLayoutScale('LG', undefined as any)

      expect(createBounds).not.toHaveBeenCalled()
    })

    it('should return early when graph has no nodes', () => {
      mockGraph.nodes = null as any

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(createBounds).not.toHaveBeenCalled()
    })

    it('should return early when graph has empty nodes array', () => {
      mockGraph.nodes = []

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(createBounds).toHaveBeenCalled()
      expect(createBounds).toHaveReturnedWith(null)
    })

    it('should return early when createBounds returns null', () => {
      mockGraph.nodes = [
        { id: 1, pos: [10, 10], size: [100, 50], width: 100, height: 50 }
      ] as any
      vi.mocked(createBounds).mockReturnValue(null)

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(layoutStore.batchUpdateNodeBounds).not.toHaveBeenCalled()
    })
  })

  describe('default renderer parameter', () => {
    it('should default to LG when no renderer is provided', () => {
      mockGraph.nodes = [
        { id: 1, pos: [10, 10], size: [100, 50], width: 100, height: 50 }
      ] as any

      ensureCorrectLayoutScale(undefined as any, mockGraph)

      expect(mockGraph.extra.workflowRendererVersion).toBe('LG')
    })

    it('should use provided renderer type when specified', () => {
      mockGraph.nodes = [
        { id: 1, pos: [10, 10], size: [100, 50], width: 100, height: 50 }
      ] as any
      vi.mocked(useVueFeatureFlags).mockReturnValue({
        shouldRenderVueNodes: { value: true }
      } as any)

      ensureCorrectLayoutScale('Vue', mockGraph)

      expect(mockGraph.extra.workflowRendererVersion).toBe('Vue')
    })
  })

  describe('no scaling needed scenarios', () => {
    it('should set workflowRendererVersion when LG renderer and Vue nodes disabled', () => {
      mockGraph.nodes = [
        { id: 1, pos: [10, 10], size: [100, 50], width: 100, height: 50 }
      ] as any
      vi.mocked(useVueFeatureFlags).mockReturnValue({
        shouldRenderVueNodes: { value: false }
      } as any)

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(mockGraph.extra.workflowRendererVersion).toBe('LG')
      expect(layoutStore.batchUpdateNodeBounds).not.toHaveBeenCalled()
    })

    it('should set workflowRendererVersion when Vue renderer and Vue nodes enabled', () => {
      mockGraph.nodes = [
        { id: 1, pos: [10, 10], size: [100, 50], width: 100, height: 50 }
      ] as any
      vi.mocked(useVueFeatureFlags).mockReturnValue({
        shouldRenderVueNodes: { value: true }
      } as any)

      ensureCorrectLayoutScale('Vue', mockGraph)

      expect(mockGraph.extra.workflowRendererVersion).toBe('Vue')
      expect(layoutStore.batchUpdateNodeBounds).not.toHaveBeenCalled()
    })

    it('should not overwrite existing workflowRendererVersion when no scaling needed', () => {
      mockGraph.nodes = [
        { id: 1, pos: [10, 10], size: [100, 50], width: 100, height: 50 }
      ] as any
      mockGraph.extra.workflowRendererVersion = 'Vue'
      vi.mocked(useVueFeatureFlags).mockReturnValue({
        shouldRenderVueNodes: { value: true }
      } as any)

      ensureCorrectLayoutScale('Vue', mockGraph)

      expect(mockGraph.extra.workflowRendererVersion).toBe('Vue')
    })
  })

  describe('upscaling from LG to Vue', () => {
    beforeEach(() => {
      vi.mocked(useVueFeatureFlags).mockReturnValue({
        shouldRenderVueNodes: { value: true }
      } as any)
      vi.mocked(createBounds).mockReturnValue([0, 0, 100, 100])
    })

    it('should scale node positions and sizes by SCALE_FACTOR (1.2)', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      mockGraph.nodes = [node] as any

      ensureCorrectLayoutScale('LG', mockGraph)

      // Original position (100, 100) relative to origin (0, 0)
      // Scaled by 1.2: (120, 120)
      expect(node.pos[0]).toBeCloseTo(120, 5)
      expect(node.pos[1]).toBeCloseTo(120, 5)
      
      // Original size (200, 150) scaled by 1.2: (240, 180)
      expect(node.size[0]).toBeCloseTo(240, 5)
      expect(node.size[1]).toBeCloseTo(180, 5)
    })

    it('should adjust Y position accounting for NODE_TITLE_HEIGHT during upscaling', () => {
      const titleHeight = LiteGraph.NODE_TITLE_HEIGHT
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      mockGraph.nodes = [node] as any

      ensureCorrectLayoutScale('LG', mockGraph)

      // Y adjustment: (100 - titleHeight) scaled, then no additional adjustment
      const expectedY = (100 - titleHeight) * 1.2
      expect(node.pos[1]).toBeCloseTo(expectedY, 5)
    })

    it('should handle multiple nodes correctly', () => {
      const nodes = [
        { id: 1, pos: [0, 0], size: [100, 100], width: 100, height: 100 },
        { id: 2, pos: [200, 200], size: [150, 100], width: 150, height: 100 },
        { id: 3, pos: [400, 100], size: [120, 80], width: 120, height: 80 }
      ]
      mockGraph.nodes = nodes as any
      vi.mocked(createBounds).mockReturnValue([0, 0, 520, 300])

      ensureCorrectLayoutScale('LG', mockGraph)

      // Verify all nodes were scaled
      nodes.forEach((node) => {
        expect(node.size[0]).toBeGreaterThan(100)
        expect(node.size[1]).toBeGreaterThan(0)
      })
    })

    it('should update layout store with batched node bounds for active graph', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      mockGraph.nodes = [node] as any
      mockCanvas.graph = mockGraph

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(layoutStore.batchUpdateNodeBounds).toHaveBeenCalledTimes(1)
      expect(layoutStore.batchUpdateNodeBounds).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            nodeId: '1',
            bounds: expect.objectContaining({
              x: expect.any(Number),
              y: expect.any(Number),
              width: expect.any(Number),
              height: expect.any(Number)
            })
          })
        ])
      )
    })

    it('should not update layout store for non-active graphs', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      const targetGraph = {
        nodes: [node],
        reroutes: new Map(),
        groups: [],
        extra: {}
      } as any

      ensureCorrectLayoutScale('LG', targetGraph)

      expect(layoutStore.batchUpdateNodeBounds).not.toHaveBeenCalled()
    })

    it('should set workflowRendererVersion to Vue after upscaling', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      mockGraph.nodes = [node] as any

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(mockGraph.extra.workflowRendererVersion).toBe('Vue')
    })
  })

  describe('downscaling from Vue to LG', () => {
    beforeEach(() => {
      vi.mocked(useVueFeatureFlags).mockReturnValue({
        shouldRenderVueNodes: { value: false }
      } as any)
      vi.mocked(createBounds).mockReturnValue([0, 0, 120, 120])
    })

    it('should scale node positions and sizes by 1/SCALE_FACTOR (1/1.2)', () => {
      const node = {
        id: 1,
        pos: [120, 120],
        size: [240, 180],
        width: 240,
        height: 180
      }
      mockGraph.nodes = [node] as any

      ensureCorrectLayoutScale('Vue', mockGraph)

      // Scaled by 1/1.2: approximately (100, 100)
      expect(node.pos[0]).toBeCloseTo(100, 5)
      expect(node.pos[1]).toBeCloseTo(100, 5)
      
      // Size scaled by 1/1.2 and adjusted for title height
      expect(node.size[0]).toBeCloseTo(200, 5)
      expect(node.size[1]).toBeCloseTo(150 - LiteGraph.NODE_TITLE_HEIGHT, 5)
    })

    it('should adjust Y position accounting for NODE_TITLE_HEIGHT during downscaling', () => {
      const titleHeight = LiteGraph.NODE_TITLE_HEIGHT
      const node = {
        id: 1,
        pos: [120, 120],
        size: [240, 180],
        width: 240,
        height: 180
      }
      mockGraph.nodes = [node] as any

      ensureCorrectLayoutScale('Vue', mockGraph)

      // Y should be scaled down and then adjusted by title height
      const expectedY = (120 / 1.2) + titleHeight
      expect(node.pos[1]).toBeCloseTo(expectedY, 5)
    })

    it('should reduce height by NODE_TITLE_HEIGHT during downscaling', () => {
      const titleHeight = LiteGraph.NODE_TITLE_HEIGHT
      const node = {
        id: 1,
        pos: [120, 120],
        size: [240, 180],
        width: 240,
        height: 180
      }
      mockGraph.nodes = [node] as any

      ensureCorrectLayoutScale('Vue', mockGraph)

      const expectedHeight = (180 / 1.2) - titleHeight
      expect(node.size[1]).toBeCloseTo(expectedHeight, 5)
    })

    it('should set workflowRendererVersion to LG after downscaling', () => {
      const node = {
        id: 1,
        pos: [120, 120],
        size: [240, 180],
        width: 240,
        height: 180
      }
      mockGraph.nodes = [node] as any

      ensureCorrectLayoutScale('Vue', mockGraph)

      expect(mockGraph.extra.workflowRendererVersion).toBe('LG')
    })
  })

  describe('reroute handling', () => {
    beforeEach(() => {
      vi.mocked(useVueFeatureFlags).mockReturnValue({
        shouldRenderVueNodes: { value: true }
      } as any)
    })

    it('should scale reroute positions during upscaling', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      const reroute = { id: 'r1', pos: [150, 150] }
      mockGraph.nodes = [node] as any
      mockGraph.reroutes = new Map([['r1', reroute]]) as any

      ensureCorrectLayoutScale('LG', mockGraph)

      // Reroute position should be scaled: (150 * 1.2, 150 * 1.2) = (180, 180)
      expect(reroute.pos[0]).toBeCloseTo(180, 5)
      expect(reroute.pos[1]).toBeCloseTo(180, 5)
    })

    it('should call moveReroute for active graph with Vue nodes enabled', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      const reroute = { id: 'r1', pos: [150, 150] }
      mockGraph.nodes = [node] as any
      mockGraph.reroutes = new Map([['r1', reroute]]) as any
      mockCanvas.graph = mockGraph

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(mockLayoutMutations.moveReroute).toHaveBeenCalledWith(
        'r1',
        expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
        expect.objectContaining({ x: 150, y: 150 })
      )
    })

    it('should not call moveReroute for non-active graph', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      const reroute = { id: 'r1', pos: [150, 150] }
      const targetGraph = {
        nodes: [node],
        reroutes: new Map([['r1', reroute]]),
        groups: [],
        extra: {}
      } as any

      ensureCorrectLayoutScale('LG', targetGraph)

      expect(mockLayoutMutations.moveReroute).not.toHaveBeenCalled()
    })

    it('should not call moveReroute when Vue nodes are disabled', () => {
      vi.mocked(useVueFeatureFlags).mockReturnValue({
        shouldRenderVueNodes: { value: false }
      } as any)

      const node = {
        id: 1,
        pos: [120, 120],
        size: [240, 180],
        width: 240,
        height: 180
      }
      const reroute = { id: 'r1', pos: [180, 180] }
      mockGraph.nodes = [node] as any
      mockGraph.reroutes = new Map([['r1', reroute]]) as any
      mockCanvas.graph = mockGraph

      ensureCorrectLayoutScale('Vue', mockGraph)

      expect(mockLayoutMutations.moveReroute).not.toHaveBeenCalled()
    })

    it('should handle multiple reroutes correctly', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      const reroutes = new Map([
        ['r1', { id: 'r1', pos: [150, 150] }],
        ['r2', { id: 'r2', pos: [200, 200] }],
        ['r3', { id: 'r3', pos: [250, 250] }]
      ])
      mockGraph.nodes = [node] as any
      mockGraph.reroutes = reroutes as any

      ensureCorrectLayoutScale('LG', mockGraph)

      // Verify all reroutes were scaled
      reroutes.forEach((reroute) => {
        expect(reroute.pos[0]).toBeGreaterThan(150)
        expect(reroute.pos[1]).toBeGreaterThan(150)
      })
    })
  })

  describe('subgraph IO node handling', () => {
    beforeEach(() => {
      vi.mocked(useVueFeatureFlags).mockReturnValue({
        shouldRenderVueNodes: { value: true }
      } as any)
    })

    it('should scale input node position and size', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      const inputNode = {
        pos: [50, 50],
        size: [100, 80]
      }
      mockGraph.nodes = [node] as any
      mockGraph.inputNode = inputNode as any

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(inputNode.pos[0]).toBeCloseTo(60, 5)
      expect(inputNode.pos[1]).toBeCloseTo(60, 5)
      expect(inputNode.size[0]).toBeCloseTo(120, 5)
      expect(inputNode.size[1]).toBeCloseTo(96, 5)
    })

    it('should scale output node position and size', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      const outputNode = {
        pos: [300, 300],
        size: [100, 80]
      }
      mockGraph.nodes = [node] as any
      mockGraph.outputNode = outputNode as any

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(outputNode.pos[0]).toBeCloseTo(360, 5)
      expect(outputNode.pos[1]).toBeCloseTo(360, 5)
      expect(outputNode.size[0]).toBeCloseTo(120, 5)
      expect(outputNode.size[1]).toBeCloseTo(96, 5)
    })

    it('should scale both input and output nodes when present', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      const inputNode = {
        pos: [50, 50],
        size: [100, 80]
      }
      const outputNode = {
        pos: [300, 300],
        size: [100, 80]
      }
      mockGraph.nodes = [node] as any
      mockGraph.inputNode = inputNode as any
      mockGraph.outputNode = outputNode as any

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(inputNode.pos[0]).toBeCloseTo(60, 5)
      expect(outputNode.pos[0]).toBeCloseTo(360, 5)
    })

    it('should handle missing input node gracefully', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      const outputNode = {
        pos: [300, 300],
        size: [100, 80]
      }
      mockGraph.nodes = [node] as any
      mockGraph.inputNode = null
      mockGraph.outputNode = outputNode as any

      expect(() => ensureCorrectLayoutScale('LG', mockGraph)).not.toThrow()
      expect(outputNode.pos[0]).toBeCloseTo(360, 5)
    })

    it('should handle missing output node gracefully', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      const inputNode = {
        pos: [50, 50],
        size: [100, 80]
      }
      mockGraph.nodes = [node] as any
      mockGraph.inputNode = inputNode as any
      mockGraph.outputNode = null

      expect(() => ensureCorrectLayoutScale('LG', mockGraph)).not.toThrow()
      expect(inputNode.pos[0]).toBeCloseTo(60, 5)
    })
  })

  describe('group handling', () => {
    beforeEach(() => {
      vi.mocked(useVueFeatureFlags).mockReturnValue({
        shouldRenderVueNodes: { value: true }
      } as any)
    })

    it('should scale group positions and sizes during upscaling', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      const group = {
        pos: [80, 80],
        size: [250, 200]
      }
      mockGraph.nodes = [node] as any
      mockGraph.groups = [group] as any

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(group.pos[0]).toBeCloseTo(96, 5)
      expect(group.size[0]).toBeCloseTo(300, 5)
      expect(group.size[1]).toBeCloseTo(240, 5)
    })

    it('should adjust group Y position for NODE_TITLE_HEIGHT during upscaling', () => {
      const titleHeight = LiteGraph.NODE_TITLE_HEIGHT
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      const group = {
        pos: [80, 100],
        size: [250, 200]
      }
      mockGraph.nodes = [node] as any
      mockGraph.groups = [group] as any

      ensureCorrectLayoutScale('LG', mockGraph)

      // Y adjustment: (100 - titleHeight) scaled, then no additional offset
      const expectedY = (100 - titleHeight) * 1.2
      expect(group.pos[1]).toBeCloseTo(expectedY, 5)
    })

    it('should scale multiple groups correctly', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      const groups = [
        { pos: [0, 0], size: [300, 300] },
        { pos: [200, 200], size: [150, 150] },
        { pos: [400, 100], size: [200, 250] }
      ]
      mockGraph.nodes = [node] as any
      mockGraph.groups = groups as any

      ensureCorrectLayoutScale('LG', mockGraph)

      // Verify all groups were scaled
      groups.forEach((group) => {
        expect(group.size[0]).toBeGreaterThan(150)
        expect(group.size[1]).toBeGreaterThan(150)
      })
    })

    it('should handle empty groups array', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      mockGraph.nodes = [node] as any
      mockGraph.groups = []

      expect(() => ensureCorrectLayoutScale('LG', mockGraph)).not.toThrow()
    })

    it('should adjust group positions during downscaling', () => {
      vi.mocked(useVueFeatureFlags).mockReturnValue({
        shouldRenderVueNodes: { value: false }
      } as any)

      const node = {
        id: 1,
        pos: [120, 120],
        size: [240, 180],
        width: 240,
        height: 180
      }
      const group = {
        pos: [96, 96],
        size: [300, 240]
      }
      mockGraph.nodes = [node] as any
      mockGraph.groups = [group] as any

      ensureCorrectLayoutScale('Vue', mockGraph)

      expect(group.pos[0]).toBeCloseTo(80, 5)
      expect(group.size[0]).toBeCloseTo(250, 5)
    })
  })

  describe('canvas scale adjustment', () => {
    beforeEach(() => {
      vi.mocked(useVueFeatureFlags).mockReturnValue({
        shouldRenderVueNodes: { value: true }
      } as any)
    })

    it('should call changeScale on canvas during upscaling', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      mockGraph.nodes = [node] as any
      mockCanvas.graph = mockGraph
      mockCanvas.ds.scale = 1.0
      mockCanvas.ds.convertOffsetToCanvas.mockReturnValue([0, 0])

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(mockCanvas.ds.changeScale).toHaveBeenCalledWith(
        1.0 / 1.2,
        [0, 0]
      )
    })

    it('should call changeScale on canvas during downscaling', () => {
      vi.mocked(useVueFeatureFlags).mockReturnValue({
        shouldRenderVueNodes: { value: false }
      } as any)

      const node = {
        id: 1,
        pos: [120, 120],
        size: [240, 180],
        width: 240,
        height: 180
      }
      mockGraph.nodes = [node] as any
      mockCanvas.graph = mockGraph
      mockCanvas.ds.scale = 0.833333
      mockCanvas.ds.convertOffsetToCanvas.mockReturnValue([0, 0])

      ensureCorrectLayoutScale('Vue', mockGraph)

      expect(mockCanvas.ds.changeScale).toHaveBeenCalledWith(
        expect.any(Number),
        [0, 0]
      )
    })

    it('should not call changeScale for non-active graph', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      const targetGraph = {
        nodes: [node],
        reroutes: new Map(),
        groups: [],
        extra: {}
      } as any

      ensureCorrectLayoutScale('LG', targetGraph)

      expect(mockCanvas.ds.changeScale).not.toHaveBeenCalled()
    })

    it('should not call changeScale when canvas is null', () => {
      ;(comfyApp as any).canvas = null
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      mockGraph.nodes = [node] as any

      expect(() => ensureCorrectLayoutScale('LG', mockGraph)).not.toThrow()
    })

    it('should use correct origin screen position for scale adjustment', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      mockGraph.nodes = [node] as any
      mockCanvas.graph = mockGraph
      vi.mocked(createBounds).mockReturnValue([50, 60, 300, 250])
      mockCanvas.ds.convertOffsetToCanvas.mockReturnValue([100, 120])

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(mockCanvas.ds.convertOffsetToCanvas).toHaveBeenCalledWith([50, 60])
      expect(mockCanvas.ds.changeScale).toHaveBeenCalledWith(
        expect.any(Number),
        [100, 120]
      )
    })
  })

  describe('edge cases and boundary conditions', () => {
    beforeEach(() => {
      vi.mocked(useVueFeatureFlags).mockReturnValue({
        shouldRenderVueNodes: { value: true }
      } as any)
    })

    it('should handle nodes at origin (0, 0)', () => {
      const node = {
        id: 1,
        pos: [0, 0],
        size: [100, 100],
        width: 100,
        height: 100
      }
      mockGraph.nodes = [node] as any
      vi.mocked(createBounds).mockReturnValue([0, 0, 100, 100])

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(node.pos[0]).toBeCloseTo(0, 5)
      expect(node.size[0]).toBeCloseTo(120, 5)
    })

    it('should handle negative positions', () => {
      const node = {
        id: 1,
        pos: [-100, -100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      mockGraph.nodes = [node] as any
      vi.mocked(createBounds).mockReturnValue([-100, -100, 100, 50])

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(node.pos[0]).toBeLessThan(0)
      expect(node.pos[1]).toBeLessThan(0)
    })

    it('should handle very small node sizes', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [1, 1],
        width: 1,
        height: 1
      }
      mockGraph.nodes = [node] as any

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(node.size[0]).toBeCloseTo(1.2, 5)
      expect(node.size[1]).toBeCloseTo(1.2, 5)
    })

    it('should handle very large node sizes', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [10000, 5000],
        width: 10000,
        height: 5000
      }
      mockGraph.nodes = [node] as any

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(node.size[0]).toBeCloseTo(12000, 5)
      expect(node.size[1]).toBeCloseTo(6000, 5)
    })

    it('should handle nodes with fractional positions', () => {
      const node = {
        id: 1,
        pos: [100.5, 100.7],
        size: [200.3, 150.9],
        width: 200.3,
        height: 150.9
      }
      mockGraph.nodes = [node] as any

      ensureCorrectLayoutScale('LG', mockGraph)

      expect(node.pos[0]).toBeCloseTo(120.6, 5)
      expect(node.size[0]).toBeCloseTo(240.36, 5)
    })

    it('should handle node with id of 0', () => {
      const node = {
        id: 0,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      mockGraph.nodes = [node] as any

      expect(() => ensureCorrectLayoutScale('LG', mockGraph)).not.toThrow()
      expect(layoutStore.batchUpdateNodeBounds).toHaveBeenCalled()
    })

    it('should handle string node IDs', () => {
      const node = {
        id: 'node-123',
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      mockGraph.nodes = [node] as any

      expect(() => ensureCorrectLayoutScale('LG', mockGraph)).not.toThrow()
    })
  })

  describe('RendererType type usage', () => {
    it('should accept valid RendererType values', () => {
      const node = {
        id: 1,
        pos: [100, 100],
        size: [200, 150],
        width: 200,
        height: 150
      }
      mockGraph.nodes = [node] as any

      const lgRenderer: RendererType = 'LG'
      const vueRenderer: RendererType = 'Vue'

      expect(() => ensureCorrectLayoutScale(lgRenderer, mockGraph)).not.toThrow()
      expect(() => ensureCorrectLayoutScale(vueRenderer, mockGraph)).not.toThrow()
    })
  })

  describe('integration scenarios', () => {
    it('should handle a complete workflow upscaling', () => {
      vi.mocked(useVueFeatureFlags).mockReturnValue({
        shouldRenderVueNodes: { value: true }
      } as any)

      const nodes = [
        { id: 1, pos: [100, 100], size: [200, 150], width: 200, height: 150 },
        { id: 2, pos: [400, 100], size: [150, 100], width: 150, height: 100 }
      ]
      const reroutes = new Map([
        ['r1', { id: 'r1', pos: [300, 150] }]
      ])
      const groups = [{ pos: [50, 50], size: [500, 300] }]
      const inputNode = { pos: [0, 100], size: [100, 80] }

      mockGraph.nodes = nodes as any
      mockGraph.reroutes = reroutes as any
      mockGraph.groups = groups as any
      mockGraph.inputNode = inputNode as any
      mockCanvas.graph = mockGraph

      ensureCorrectLayoutScale('LG', mockGraph)

      // Verify all elements were scaled
      expect(nodes[0].size[0]).toBeCloseTo(240, 5)
      expect(nodes[1].size[0]).toBeCloseTo(180, 5)
      expect(reroutes.get('r1')?.pos[0]).toBeCloseTo(360, 5)
      expect(groups[0].size[0]).toBeCloseTo(600, 5)
      expect(inputNode.size[0]).toBeCloseTo(120, 5)
      expect(mockGraph.extra.workflowRendererVersion).toBe('Vue')
      expect(layoutStore.batchUpdateNodeBounds).toHaveBeenCalled()
      expect(mockCanvas.ds.changeScale).toHaveBeenCalled()
    })

    it('should handle a complete workflow downscaling', () => {
      vi.mocked(useVueFeatureFlags).mockReturnValue({
        shouldRenderVueNodes: { value: false }
      } as any)

      const nodes = [
        { id: 1, pos: [120, 120], size: [240, 180], width: 240, height: 180 },
        { id: 2, pos: [480, 120], size: [180, 120], width: 180, height: 120 }
      ]
      const reroutes = new Map([
        ['r1', { id: 'r1', pos: [360, 180] }]
      ])
      const groups = [{ pos: [60, 60], size: [600, 360] }]

      mockGraph.nodes = nodes as any
      mockGraph.reroutes = reroutes as any
      mockGraph.groups = groups as any
      mockCanvas.graph = mockGraph

      ensureCorrectLayoutScale('Vue', mockGraph)

      // Verify all elements were scaled down
      expect(nodes[0].size[0]).toBeCloseTo(200, 5)
      expect(nodes[1].size[0]).toBeCloseTo(150, 5)
      expect(reroutes.get('r1')?.pos[0]).toBeCloseTo(300, 5)
      expect(groups[0].size[0]).toBeCloseTo(500, 5)
      expect(mockGraph.extra.workflowRendererVersion).toBe('LG')
    })
  })
})