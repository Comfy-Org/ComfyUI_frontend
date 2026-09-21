import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { fromAny } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref, shallowRef } from 'vue'
import type { MaybeRefOrGetter } from 'vue'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { GLSLRendererConfig } from '@/renderer/glsl/useGLSLRenderer'
import { useGLSLPreview } from '@/renderer/glsl/useGLSLPreview'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'
import { createNodeLocatorId } from '@/types/nodeIdentification'

const mockRendererFactory = vi.hoisted(() => {
  const init = vi.fn(() => true)
  const compileFragment = vi.fn(() => ({ success: true, log: '' }))
  const setResolution = vi.fn()
  const setFloatUniform = vi.fn()
  const setIntUniform = vi.fn()
  const setBoolUniform = vi.fn()
  const bindCurveTexture = vi.fn()
  const bindInputImage = vi.fn()
  const clearInputImage = vi.fn()
  const isContextLost = vi.fn(() => false)
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
        clearInputImage,
        isContextLost,
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
    clearInputImage,
    isContextLost,
    render,
    toBlob,
    dispose
  }
})

vi.mock<unknown>(import('@/renderer/glsl/useGLSLRenderer'), () => ({
  useGLSLRenderer: (config?: GLSLRendererConfig) =>
    mockRendererFactory.create(config)
}))

vi.mock(import('@/utils/objectUrlUtil'), () => ({
  createSharedObjectUrl: () => 'blob:test',
  releaseSharedObjectUrl: vi.fn()
}))

function createMockNode(overrides: Record<string, unknown> = {}): LGraphNode {
  const rootGraph = { id: 'test-graph-id', _nodes: [] }
  const graph = { id: 'test-graph-id', rootGraph }
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

function ensureImageBitmap(global: { ImageBitmap?: typeof ImageBitmap }): void {
  global.ImageBitmap ??= class ImageBitmap {} as unknown as typeof ImageBitmap
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
  vi.mocked(useNodeOutputStore().getNodeImageUrls).mockReturnValue(undefined)
})

describe('useGLSLPreview', () => {
  beforeEach(() => {
    mockRendererFactory.lastConfig.value = undefined
    globalThis.URL.createObjectURL = vi.fn(() => 'blob:test')
    globalThis.URL.revokeObjectURL = vi.fn()
    ensureImageBitmap(globalThis)
  })

  it('does not activate for non-GLSLShader nodes', () => {
    const node = createMockNode({ type: 'KSampler' })
    const { isActive } = useGLSLPreview(wrapNode(node))
    expect(isActive.value).toBe(false)
  })

  it('does not activate before first execution', () => {
    const node = createMockNode()
    Object.keys(useNodeOutputStore().nodeOutputs).forEach(
      (k) => delete useNodeOutputStore().nodeOutputs[k]
    )
    const { isActive } = useGLSLPreview(wrapNode(node))
    expect(isActive.value).toBe(false)
  })

  it('activates for GLSLShader nodes with execution output', () => {
    const node = createMockNode()
    useNodeOutputStore().nodeOutputs['1'] = {
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
    async function triggerRender(node: LGraphNode) {
      useNodeOutputStore().nodeOutputs[String(node.id)] = {
        images: [{ filename: 'test.png', subfolder: '', type: 'temp' }]
      }
      const store = useWidgetValueStore()
      store.registerWidget(
        widgetId('test-graph-id', node.id, 'fragment_shader'),
        { type: 'customtext', options: {}, value: 'void main() {}' }
      )

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
    async function setupAndRender(node: LGraphNode) {
      useNodeOutputStore().nodeOutputs[String(node.id)] = {
        images: [{ filename: 'test.png', subfolder: '', type: 'temp' }]
      }
      const store = useWidgetValueStore()
      store.registerWidget(
        widgetId('test-graph-id', node.id, 'fragment_shader'),
        { type: 'customtext', options: {}, value: 'void main() {}' }
      )

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

    it('recreates the renderer when its context was lost', async () => {
      const node = createMockNode()
      await setupAndRender(node)
      expect(mockRendererFactory.init).toHaveBeenCalledTimes(1)

      mockRendererFactory.isContextLost.mockReturnValueOnce(true)
      delete useNodeOutputStore().nodeOutputs['1']
      await nextTick()
      useNodeOutputStore().nodeOutputs['1'] = {
        images: [{ filename: 'test.png', subfolder: '', type: 'temp' }]
      }
      await nextTick()
      vi.advanceTimersByTime(100)
      for (let i = 0; i < 5; i++) await nextTick()

      expect(mockRendererFactory.dispose).toHaveBeenCalledTimes(1)
      expect(mockRendererFactory.init).toHaveBeenCalledTimes(2)
    })

    it('binds a resolved image to its original slot when an earlier slot is unresolved', async () => {
      const image1 = fromAny<HTMLImageElement, unknown>({
        naturalWidth: 64,
        naturalHeight: 64
      })
      const node = createMockNode({
        inputs: [
          { name: 'images.image0', link: 10 },
          { name: 'images.image1', link: 11 }
        ],
        getInputNode: vi.fn((slot: number) =>
          slot === 1 ? fromAny({ imgs: [image1] }) : null
        )
      })
      await setupAndRender(node)
      for (let i = 0; i < 5; i++) await nextTick()

      expect(mockRendererFactory.bindInputImage).toHaveBeenCalledTimes(1)
      expect(mockRendererFactory.bindInputImage).toHaveBeenCalledWith(1, image1)
    })

    it('clears a previously bound texture when its slot becomes unavailable while another still resolves', async () => {
      const img0 = fromAny<HTMLImageElement, unknown>({
        naturalWidth: 32,
        naturalHeight: 32
      })
      const img1 = fromAny<HTMLImageElement, unknown>({
        naturalWidth: 32,
        naturalHeight: 32
      })
      const up0 = { imgs: [img0] as unknown[] }
      const up1 = { imgs: [img1] as unknown[] }
      const node = createMockNode({
        inputs: [
          { name: 'images.image0', link: 10 },
          { name: 'images.image1', link: 11 }
        ],
        getInputNode: vi.fn((slot: number) => fromAny(slot === 0 ? up0 : up1))
      })
      const store = useWidgetValueStore()
      store.registerWidget(
        widgetId('test-graph-id', node.id, 'fragment_shader'),
        { type: 'customtext', options: {}, value: 'void main() {}' }
      )
      useNodeOutputStore().nodeOutputs['1'] = {
        images: [{ filename: 'a.png', subfolder: '', type: 'temp' }]
      }

      const nodeRef = shallowRef<LGraphNode | null>(null)
      useGLSLPreview(nodeRef)
      nodeRef.value = node
      await nextTick()
      vi.advanceTimersByTime(100)
      for (let i = 0; i < 6; i++) await nextTick()

      expect(mockRendererFactory.bindInputImage).toHaveBeenCalledWith(0, img0)
      expect(mockRendererFactory.bindInputImage).toHaveBeenCalledWith(1, img1)

      up0.imgs = []
      vi.clearAllMocks()
      delete useNodeOutputStore().nodeOutputs['1']
      await nextTick()
      useNodeOutputStore().nodeOutputs['1'] = {
        images: [{ filename: 'a.png', subfolder: '', type: 'temp' }]
      }
      await nextTick()
      vi.advanceTimersByTime(100)
      for (let i = 0; i < 6; i++) await nextTick()

      expect(mockRendererFactory.clearInputImage).toHaveBeenCalledWith(0)
      expect(mockRendererFactory.bindInputImage).toHaveBeenCalledWith(1, img1)
      expect(mockRendererFactory.bindInputImage).not.toHaveBeenCalledWith(
        0,
        expect.anything()
      )
    })

    it('hides the executed output after publishing a live preview', async () => {
      const node = createMockNode()
      const { hideExecutedOutput } = await setupAndRender(node)
      for (let i = 0; i < 5; i++) await nextTick()

      expect(hideExecutedOutput.value).toBe(true)
    })

    it('revokes the live preview and reveals the executed output when the input is unavailable', async () => {
      const node = createMockNode({
        inputs: [{ name: 'images.image0', link: 10 }],
        getInputNode: vi.fn(() => null)
      })
      const { hideExecutedOutput } = await setupAndRender(node)
      for (let i = 0; i < 5; i++) await nextTick()

      expect(hideExecutedOutput.value).toBe(false)
      expect(
        useNodeOutputStore().revokePreviewsByLocatorId
      ).toHaveBeenCalledWith('1')
      expect(mockRendererFactory.compileFragment).not.toHaveBeenCalled()
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
      const node = createMockNode()
      const store = useWidgetValueStore()
      store.deleteWidget(widgetId('test-graph-id', node.id, 'fragment_shader'))
      useNodeOutputStore().nodeOutputs[String(node.id)] = {
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

    it('uses custom resolution when size_mode is custom', async () => {
      const store = useWidgetValueStore()

      const node = createMockNode()
      store.registerWidget(widgetId('test-graph-id', node.id, 'size_mode'), {
        type: 'customtext',
        options: {},
        value: 'custom'
      })
      store.registerWidget(
        widgetId('test-graph-id', node.id, 'size_mode.width'),
        { type: 'customtext', options: {}, value: 800 }
      )
      store.registerWidget(
        widgetId('test-graph-id', node.id, 'size_mode.height'),
        { type: 'customtext', options: {}, value: 600 }
      )
      await setupAndRender(node)

      expect(mockRendererFactory.setResolution).toHaveBeenCalledWith(800, 600)

      store.deleteWidget(widgetId('test-graph-id', node.id, 'size_mode'))
      store.deleteWidget(widgetId('test-graph-id', node.id, 'size_mode.width'))
      store.deleteWidget(widgetId('test-graph-id', node.id, 'size_mode.height'))
    })

    it('uses default resolution when size_mode is not custom', async () => {
      const store = useWidgetValueStore()

      const node = createMockNode()
      store.registerWidget(widgetId('test-graph-id', node.id, 'size_mode'), {
        type: 'customtext',
        options: {},
        value: 'from_input'
      })
      await setupAndRender(node)

      expect(mockRendererFactory.setResolution).toHaveBeenCalledWith(512, 512)

      store.deleteWidget(widgetId('test-graph-id', node.id, 'size_mode'))
    })

    it('disposes renderer and cancels debounce on cleanup', async () => {
      const node = createMockNode()
      const { dispose } = await setupAndRender(node)

      dispose()

      expect(mockRendererFactory.dispose).toHaveBeenCalled()
    })
  })
})
