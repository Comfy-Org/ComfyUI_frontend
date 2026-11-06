import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, shallowRef } from 'vue'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { createDOMWidgetNode } from '@/renderer/extensions/vueNodes/widgets/composables/domWidgetTestUtils'
import { useStringWidget } from '@/renderer/extensions/vueNodes/widgets/composables/useStringWidget'
import { DEBOUNCE_MS } from '@/renderer/glsl/glslPreviewUtils'
import { useGLSLPreview } from '@/renderer/glsl/useGLSLPreview'
import type { GLSLRendererConfig } from '@/renderer/glsl/useGLSLRenderer'
import type { InputSpec } from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import { createNodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import { toNodeId } from '@comfyorg/graph-model/nodeId'

/**
 * Guards the writer/reader store contract behind the GLSL live preview: the
 * real customtext writer (useStringWidget), the real widgetValueStore, and the
 * real reader (useGLSLPreview) must agree on the widgetId. Regression for the
 * store-backed customtext write that #13851 fixed.
 */

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

vi.mock<unknown>(import('@/renderer/glsl/useGLSLRenderer'), () => ({
  useGLSLRenderer: (_config?: GLSLRendererConfig) => mockRenderer.create()
}))

vi.mock(import('@/scripts/app'))

function seedShaderThroughWidget(node: LGraphNode, value: string): void {
  const inputSpec: InputSpec = {
    type: 'STRING',
    name: 'fragment_shader',
    default: '',
    multiline: true
  }
  const widget = useStringWidget()(node, inputSpec)
  widget.value = value
}

beforeEach(() => {
  vi.mocked(useWorkflowStore().nodeIdToNodeLocatorId).mockImplementation((id) =>
    createNodeLocatorId(null, id)
  )
  vi.mocked(useWorkflowStore().nodeToNodeLocatorId).mockImplementation((node) =>
    createNodeLocatorId(null, node.id)
  )
  vi.mocked(useNodeOutputStore().setNodePreviewsByNodeId).mockImplementation(
    () => undefined
  )
  vi.mocked(useNodeOutputStore().setNodePreviewsByLocatorId).mockImplementation(
    () => undefined
  )
  vi.mocked(useNodeOutputStore().revokePreviewsByLocatorId).mockImplementation(
    () => undefined
  )
})

describe('GLSL live preview reads the shader written by the customtext widget', () => {
  beforeEach(() => {
    for (const key of Object.keys(useNodeOutputStore().nodeOutputs))
      delete useNodeOutputStore().nodeOutputs[key]
  })

  it('compiles the shader value written through the widget store path', async () => {
    const nodeId = 1
    const node = createDOMWidgetNode({
      id: toNodeId(nodeId),
      type: 'GLSLShader',
      graph: new LGraph()
    })
    seedShaderThroughWidget(node, SHADER)
    useNodeOutputStore().nodeOutputs[String(nodeId)] = {
      images: [{ filename: 'test.png', subfolder: '', type: 'temp' }]
    }

    const nodeRef = shallowRef<LGraphNode | null>(null)
    useGLSLPreview(nodeRef)
    nodeRef.value = node

    await nextTick()
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS)

    expect(mockRenderer.compileFragment).toHaveBeenCalledWith(SHADER)
  })
})
