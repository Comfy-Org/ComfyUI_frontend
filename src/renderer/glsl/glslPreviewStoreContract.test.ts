import { fromAny } from '@total-typescript/shoehorn'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, shallowRef } from 'vue'

import type * as Litegraph from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createMockDOMWidgetNode } from '@/renderer/extensions/vueNodes/widgets/composables/domWidgetTestUtils'
import { useStringWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useStringWidget'
import type { GLSLRendererConfig } from '@/renderer/glsl/useGLSLRenderer'
import { useGLSLPreview } from '@/renderer/glsl/useGLSLPreview'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'

/**
 * Regression guard for the GLSL live-preview break (QA 2026-07-20, Terry Jia).
 *
 * The `fragment_shader` is a multiline (`customtext`) DOM widget. Vue Nodes
 * read its value only from `widgetValueStore`, and `useGLSLPreview` reads the
 * shader source from that same store by `widgetId(graphId, nodeId, name)`.
 * The store-backed widget refactor (#12617, 1.47) made the customtext widget's
 * `setValue` drop the write when no store entry existed yet, so the reader saw
 * an empty shader and the preview never rendered (#13851 fix).
 *
 * This test wires the real writer (useStringWidget) to the real reader
 * (useGLSLPreview) through the real widgetValueStore — no store mock — so any
 * future divergence of the writer/reader store contract fails here.
 */

const GRAPH_ID = 'root'
const SHADER = 'void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }'

const mockRenderer = vi.hoisted(() => {
  const compileFragment = vi.fn(() => ({ success: true, log: '' }))
  return {
    compileFragment,
    create: () => ({
      init: vi.fn(() => true),
      compileFragment,
      setResolution: vi.fn(),
      setFloatUniform: vi.fn(),
      setIntUniform: vi.fn(),
      setBoolUniform: vi.fn(),
      bindCurveTexture: vi.fn(),
      bindInputImage: vi.fn(),
      render: vi.fn(),
      toBlob: vi.fn(() => Promise.resolve(new Blob(['x']))),
      dispose: vi.fn()
    })
  }
})

vi.mock('@/renderer/glsl/useGLSLRenderer', () => ({
  useGLSLRenderer: (_config?: GLSLRendererConfig) => mockRenderer.create()
}))

const nodeOutputs = reactive<Record<string, unknown>>({})
vi.mock('@/stores/nodeOutputStore', () => ({
  useNodeOutputStore: () => ({
    setNodePreviewsByNodeId: vi.fn(),
    setNodePreviewsByLocatorId: vi.fn(),
    revokePreviewsByLocatorId: vi.fn(),
    nodeOutputs
  })
}))

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

vi.mock('@/scripts/app', () => ({
  app: {
    rootGraph: { id: 'root' },
    canvas: {
      processMouseDown: vi.fn(),
      processMouseMove: vi.fn(),
      processMouseUp: vi.fn(),
      processMouseWheel: vi.fn()
    }
  }
}))

vi.mock('@/lib/litegraph/src/litegraph', async (importOriginal) => {
  const actual = await importOriginal<typeof Litegraph>()
  return { ...actual, resolveNodeRootGraphId: vi.fn(() => 'root') }
})

vi.mock('@/platform/settings/settingStore', () => ({
  useSettingStore: () => ({ get: () => false })
}))

function seedShaderThroughWidget(nodeId: number, value: string): void {
  const node = createMockDOMWidgetNode({ id: nodeId }) as LGraphNode
  const inputSpec: InputSpec = {
    type: 'STRING',
    name: 'fragment_shader',
    default: '',
    multiline: true
  }
  useStringWidget()(node, inputSpec)

  const addDOMWidget = node.addDOMWidget as unknown as {
    mock: { calls: unknown[][] }
  }
  const options = addDOMWidget.mock.calls[0][3] as {
    setValue: (v: string) => void
  }
  // Mirrors the imperative / execution-time write (domWidget `set value`)
  // that arrives before any store entry exists.
  options.setValue(value)
}

function createGLSLNode(nodeId: number): LGraphNode {
  return fromAny<LGraphNode, unknown>({
    id: nodeId,
    type: 'GLSLShader',
    inputs: [],
    graph: { id: GRAPH_ID, rootGraph: { id: GRAPH_ID } },
    getInputNode: () => null,
    isSubgraphNode: () => false
  })
}

describe('GLSL live preview reads the shader written by the customtext widget', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    for (const key of Object.keys(nodeOutputs)) delete nodeOutputs[key]
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('compiles the shader value written through the widget store path', async () => {
    const nodeId = 1
    seedShaderThroughWidget(nodeId, SHADER)
    nodeOutputs[String(nodeId)] = {
      images: [{ filename: 'test.png', subfolder: '', type: 'temp' }]
    }

    const nodeRef = shallowRef<LGraphNode | null>(null)
    useGLSLPreview(nodeRef)
    nodeRef.value = createGLSLNode(nodeId)

    await nextTick()
    vi.advanceTimersByTime(100)
    await nextTick()
    await nextTick()

    expect(mockRenderer.compileFragment).toHaveBeenCalledWith(SHADER)
  })
})
