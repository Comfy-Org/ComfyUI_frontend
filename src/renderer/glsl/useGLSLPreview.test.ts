import { fromAny } from '@total-typescript/shoehorn'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, ref, shallowRef } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { GLSLRendererConfig } from '@/renderer/glsl/useGLSLRenderer'
import { useGLSLPreview } from '@/renderer/glsl/useGLSLPreview'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

type WidgetValueStoreStub = {
  _widgetMap: Map<string, { value: unknown }>
}

const mockRendererFactory = vi.hoisted(() => {
  const init = vi.fn(() => true)
  const compileFragment = vi.fn(() => ({ success: true, log: '' }))
  const setResolution = vi.fn()
  const setFloatUniform = vi.fn()
  const setIntUniform = vi.fn()
  const setBoolUniform = vi.fn()
  const bindCurveTexture = vi.fn()
  const bindInputImage = vi.fn()
  const render = vi.fn()
  const toBlob = vi.fn(() => Promise.resolve(new Blob(['test'])))
  const dispose = vi.fn()
  const lastConfig = { value: undefined as GLSLRendererConfig | undefined }

  return {
    create: (config?: GLSLRendererConfig) => {
      lastConfig.value = config
      return {
        init,
        compileFragment,
        setResolution,
        setFloatUniform,
        setIntUniform,
        setBoolUniform,
        bindCurveTexture,
        bindInputImage,
        render,
        toBlob,
        dispose
      }
    },
    lastConfig,
    init,
    compileFragment,
    setResolution,
    setFloatUniform,
    setIntUniform,
    setBoolUniform,
    bindCurveTexture,
    bindInputImage,
    render,
    toBlob,
    dispose
  }
})

vi.mock('@/renderer/glsl/useGLSLRenderer', () => ({
  useGLSLRenderer: (config?: GLSLRendererConfig) =>
    mockRendererFactory.create(config)
}))

const mockSetNodePreviewsByNodeId = vi.fn()
const mockNodeOutputs = reactive<Record<string, unknown>>({})

vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({
    setNodePreviewsByNodeId: mockSetNodePreviewsByNodeId,
    setNodePreviewsByLocatorId: vi.fn(),
    revokePreviewsByLocatorId: vi.fn(),
    nodeOutputs: mockNodeOutputs
  })
}))

vi.mock('@/stores/widgetValueStore', () => {
  const widgetMap = new Map<string, { value: unknown }>()
  const getWidget = vi.fn((_graphId: string, _nodeId: string, name: string) =>
    widgetMap.get(name)
  )
  return {
    useWidgetValueStore: () => ({
      getWidget,
      _widgetMap: widgetMap
    })
  }
})

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    nodeIdToNodeLocatorId: (id: string | number) => String(id),
    nodeToNodeLocatorId: (node: { id: string | number }) => String(node.id)
  })
}))

vi.mock('@/utils/objectUrlUtil', () => ({
  createSharedObjectUrl: () => 'blob:test',
  releaseSharedObjectUrl: vi.fn()
}))

function createMockNode(overrides: Record<string, unknown> = {}): LGraphNode {
  const graph = { id: 'test-graph-id', rootGraph: { id: 'test-graph-id' } }
  return fromAny<LGraphNode, unknown>({
    id: 1,
    type: 'GLSLShader',
    inputs: [],
    graph,
    getInputNode: vi.fn(() => null),
    isSubgraphNode: () => false,
    ...overrides
  })
}

function wrapNode(
  node: LGraphNode | null
): MaybeRefOrGetter<LGraphNode | null> {
  return ref(node) as MaybeRefOrGetter<LGraphNode | null>
}

describe('useGLSLPreview', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockRendererFactory.lastConfig.value = undefined
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:test')
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  it('does not activate for non-GLSLShader nodes', () => {
    const node = createMockNode({ type: 'KSampler' })
    const { isActive } = useGLSLPreview(wrapNode(node))
    expect(isActive.value).toBe(false)
  })

  it('does not activate before first execution', () => {
    const node = createMockNode()
    Object.keys(mockNodeOutputs).forEach((k) => delete mockNodeOutputs[k])
    const { isActive } = useGLSLPreview(wrapNode(node))
    expect(isActive.value).toBe(false)
  })

  it('activates for GLSLShader nodes with execution output', () => {
    const node = createMockNode()
    mockNodeOutputs['1'] = {
      images: [{ filename: 'test.png', subfolder: '', type: 'temp' }]
    }
    const { isActive } = useGLSLPreview(wrapNode(node))
    expect(isActive.value).toBe(true)
  })

  it('exposes lastError as null initially', () => {
    const node = createMockNode()
    const { lastError } = useGLSLPreview(wrapNode(node))
    expect(lastError.value).toBe(null)
  })

  it('does not activate for null node', () => {
    const { isActive } = useGLSLPreview(wrapNode(null))
    expect(isActive.value).toBe(false)
  })

  it('cleans up on dispose', () => {
    const node = createMockNode()
    const { dispose } = useGLSLPreview(wrapNode(node))
    expect(() => dispose()).not.toThrow()
  })

  describe('autogrow config extraction', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    async function triggerRender(node: LGraphNode) {
      mockNodeOutputs[String(node.id)] = {
        images: [{ filename: 'test.png', subfolder: '', type: 'temp' }]
      }
      const store = fromAny<WidgetValueStoreStub, unknown>(
        useWidgetValueStore()
      )
      store._widgetMap.set('fragment_shader', {
        value: 'void main() {}'
      })

      const nodeRef = shallowRef<LGraphNode | null>(null)
      useGLSLPreview(nodeRef)

      nodeRef.value = node
      await nextTick()
      vi.advanceTimersByTime(100)
      await nextTick()
    }

    it('passes default config when node has no comfyDynamic', async () => {
      const node = createMockNode()
      await triggerRender(node)

      expect(mockRendererFactory.lastConfig.value).toEqual({
        maxInputs: 5,
        maxFloatUniforms: 20,
        maxIntUniforms: 20,
        maxBoolUniforms: 10,
        maxCurves: 4
      })
    })

    it('extracts autogrow limits from node comfyDynamic', async () => {
      const node = createMockNode({
        comfyDynamic: {
          autogrow: {
            images: { min: 1, max: 3 },
            floats: { min: 0, max: 8 },
            ints: { min: 0, max: 4 }
          }
        }
      })
      await triggerRender(node)

      expect(mockRendererFactory.lastConfig.value).toEqual({
        maxInputs: 3,
        maxFloatUniforms: 8,
        maxIntUniforms: 4,
        maxBoolUniforms: 10,
        maxCurves: 4
      })
    })
  })

  describe('render pipeline', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    async function setupAndRender(node: LGraphNode) {
      mockNodeOutputs[String(node.id)] = {
        images: [{ filename: 'test.png', subfolder: '', type: 'temp' }]
      }
      const store = fromAny<WidgetValueStoreStub, unknown>(
        useWidgetValueStore()
      )
      store._widgetMap.set('fragment_shader', {
        value: 'void main() {}'
      })

      const nodeRef = shallowRef<LGraphNode | null>(null)
      const result = useGLSLPreview(nodeRef)

      nodeRef.value = node
      await nextTick()
      vi.advanceTimersByTime(100)
      await nextTick()
      // Allow async renderPreview to complete
      await nextTick()

      return result
    }

    it('calls compileFragment, render, and toBlob in sequence', async () => {
      const node = createMockNode()
      await setupAndRender(node)

      expect(mockRendererFactory.compileFragment).toHaveBeenCalledWith(
        'void main() {}'
      )
      expect(mockRendererFactory.render).toHaveBeenCalled()
      expect(mockRendererFactory.toBlob).toHaveBeenCalled()

      const compileOrder =
        mockRendererFactory.compileFragment.mock.invocationCallOrder[0]
      const renderOrder = mockRendererFactory.render.mock.invocationCallOrder[0]
      const toBlobOrder = mockRendererFactory.toBlob.mock.invocationCallOrder[0]
      expect(compileOrder).toBeLessThan(renderOrder)
      expect(renderOrder).toBeLessThan(toBlobOrder)
    })

    it('sets lastError on compilation failure', async () => {
      mockRendererFactory.compileFragment.mockReturnValueOnce({
        success: false,
        log: 'syntax error at line 5'
      })

      const node = createMockNode()
      const { lastError } = await setupAndRender(node)

      expect(lastError.value).toBe('syntax error at line 5')
    })

    it('clears lastError on successful compilation', async () => {
      const node = createMockNode()
      const { lastError } = await setupAndRender(node)

      expect(lastError.value).toBe(null)
    })

    it('skips render when shader source is unavailable', async () => {
      const store = fromAny<WidgetValueStoreStub, unknown>(
        useWidgetValueStore()
      )
      store._widgetMap.delete('fragment_shader')

      const node = createMockNode()
      mockNodeOutputs[String(node.id)] = {
        images: [{ filename: 'test.png', subfolder: '', type: 'temp' }]
      }

      const nodeRef = shallowRef<LGraphNode | null>(null)
      useGLSLPreview(nodeRef)
      nodeRef.value = node
      await nextTick()
      vi.advanceTimersByTime(100)
      await nextTick()

      expect(mockRendererFactory.compileFragment).not.toHaveBeenCalled()
    })

    it('disposes renderer and cancels debounce on cleanup', async () => {
      const node = createMockNode()
      const { dispose } = await setupAndRender(node)

      dispose()

      expect(mockRendererFactory.dispose).toHaveBeenCalled()
    })
  })
})
