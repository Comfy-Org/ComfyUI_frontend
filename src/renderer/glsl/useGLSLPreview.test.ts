import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { useGLSLPreview } from '@/renderer/glsl/useGLSLPreview'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { MaybeRefOrGetter } from 'vue'

vi.mock('@/renderer/glsl/useGLSLRenderer', () => {
  const init = vi.fn(() => true)
  const compileFragment = vi.fn(() => ({ success: true, log: '' }))
  const setResolution = vi.fn()
  const setFloatUniform = vi.fn()
  const setIntUniform = vi.fn()
  const bindInputImage = vi.fn()
  const render = vi.fn()
  const toBlob = vi.fn(() => Promise.resolve(new Blob(['test'])))
  const dispose = vi.fn()

  return {
    useGLSLRenderer: () => ({
      init,
      compileFragment,
      setResolution,
      setFloatUniform,
      setIntUniform,
      bindInputImage,
      render,
      toBlob,
      dispose
    })
  }
})

const mockGetNodeOutputs = vi.fn()
const mockSetNodePreviewsByNodeId = vi.fn()

vi.mock('@/stores/imagePreviewStore', () => ({
  useNodeOutputStore: () => ({
    getNodeOutputs: mockGetNodeOutputs,
    setNodePreviewsByNodeId: mockSetNodePreviewsByNodeId,
    nodeOutputs: ref({})
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

function createMockNode(overrides: Record<string, unknown> = {}): LGraphNode {
  return {
    id: 1,
    type: 'GLSLShader',
    inputs: [],
    graph: { id: 'test-graph-id' },
    getInputNode: vi.fn(() => null),
    ...overrides
  } as unknown as LGraphNode
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
    mockGetNodeOutputs.mockReturnValue(undefined)
    const { isActive } = useGLSLPreview(wrapNode(node))
    expect(isActive.value).toBe(false)
  })

  it('activates for GLSLShader nodes with execution output', () => {
    const node = createMockNode()
    mockGetNodeOutputs.mockReturnValue({
      images: [{ filename: 'test.png', subfolder: '', type: 'temp' }]
    })
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
})
