import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, reactive, shallowRef } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useStringWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useStringWidget'
import { DEBOUNCE_MS } from '@/renderer/glsl/glslPreviewUtils'
import { useGLSLPreview } from '@/renderer/glsl/useGLSLPreview'
import type { GLSLRendererConfig } from '@/renderer/glsl/useGLSLRenderer'
import type { InputSpec } from '@/schemas/nodeDef/nodeDefSchemaV2'
import { toNodeId } from '@/types/nodeId'

/**
 * Guards the writer/reader store contract behind the GLSL live preview: the
 * real customtext writer (useStringWidget), the real widgetValueStore, and the
 * real reader (useGLSLPreview) must agree on the widgetId. Regression for the
 * store-backed customtext write that #13851 fixed.
 */

const GRAPH_ID = '00000000-0000-4000-8000-000000000001'
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
      isContextLost: vi.fn(() => false),
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

function seedShaderThroughWidget(nodeId: number, value: string): void {
  const graph = new LGraph()
  graph.id = GRAPH_ID
  const node = new LGraphNode('GLSLShader')
  node.id = toNodeId(nodeId)
  graph.add(node)
  const inputSpec: InputSpec = {
    type: 'STRING',
    name: 'fragment_shader',
    default: '',
    multiline: true
  }
  const widget = useStringWidget()(node, inputSpec)
  widget.value = value
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
    for (const key of Object.keys(nodeOutputs)) delete nodeOutputs[key]
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
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(mockRenderer.compileFragment).toHaveBeenCalledWith(SHADER)
  })
})
