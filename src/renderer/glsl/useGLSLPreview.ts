import { debounce } from 'es-toolkit/compat'
import { computed, effectScope, onScopeDispose, ref, toValue, watch } from 'vue'

import type { ComputedRef, EffectScope, MaybeRefOrGetter, Ref } from 'vue'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { UUID } from '@/utils/uuid'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { widgetId } from '@/types/widgetId'

import { curveDataToFloatLUT } from '@/components/curve/curveUtils'
import type { GLSLRendererConfig } from '@/renderer/glsl/useGLSLRenderer'
import { useGLSLRenderer } from '@/renderer/glsl/useGLSLRenderer'
import {
  extractUniformSources,
  getAutogrowLimits,
  useGLSLUniforms
} from '@/renderer/glsl/useGLSLUniforms'
import {
  createSharedObjectUrl,
  releaseSharedObjectUrl
} from '@/utils/objectUrlUtil'

import {
  clampResolution,
  DEBOUNCE_MS,
  DEFAULT_SIZE,
  getImageThroughSubgraphBoundary,
  GLSL_NODE_TYPE,
  normalizeDimension
} from '@/renderer/glsl/glslPreviewUtils'

/**
 * Two-tier composable for GLSL live preview.
 *
 * Outer tier (always created): only 2 cheap computed refs to detect
 * whether the node is GLSL-related. For non-GLSL nodes this is the
 * only cost — no watchers, store subscriptions, or renderer.
 *
 * Inner tier (lazy): created via effectScope when the node is detected
 * as a GLSLShader or a subgraph containing one. Contains all the
 * expensive logic: store reads, watchers, debounce, WebGL renderer.
 */
export function useGLSLPreview(
  nodeMaybe: MaybeRefOrGetter<LGraphNode | null | undefined>
) {
  const lastError = ref<string | null>(null)
  const hideExecutedOutput = ref(false)

  const nodeRef = computed(() => toValue(nodeMaybe) ?? null)

  const isGLSLNode = computed(() => nodeRef.value?.type === GLSL_NODE_TYPE)

  const isGLSLSubgraphNode = computed(() => {
    const node = nodeRef.value
    if (!node?.isSubgraphNode()) return false
    const subgraph = node.subgraph as Subgraph | undefined
    return subgraph?.nodes.some((n) => n.type === GLSL_NODE_TYPE) ?? false
  })

  const isGLSLRelated = computed(
    () => isGLSLNode.value || isGLSLSubgraphNode.value
  )

  let innerScope: EffectScope | null = null
  let innerDispose: (() => void) | null = null
  const isActive = ref(false)

  watch(
    isGLSLRelated,
    (related) => {
      if (related && !innerScope) {
        innerScope = effectScope()
        innerDispose = innerScope.run(() =>
          createInnerPreview(
            nodeRef,
            isGLSLNode,
            isGLSLSubgraphNode,
            lastError,
            isActive,
            hideExecutedOutput
          )
        )!
      } else if (!related && innerScope) {
        innerDispose?.()
        innerScope.stop()
        innerScope = null
        innerDispose = null
        isActive.value = false
      }
    },
    { immediate: true }
  )

  onScopeDispose(() => {
    innerDispose?.()
    innerScope?.stop()
  })

  return {
    isActive: computed(() => isActive.value),
    hideExecutedOutput: computed(() => hideExecutedOutput.value),
    lastError,
    dispose() {
      innerDispose?.()
      innerScope?.stop()
      innerScope = null
      innerDispose = null
    }
  }
}

/**
 * Inner tier: all expensive GLSL preview logic.
 * Runs inside its own effectScope so it can be created/destroyed
 * independently of the component lifecycle.
 * Returns a dispose function.
 */
type InputImage = HTMLImageElement | ImageBitmap

function loadImageFromUrl(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function createInnerPreview(
  nodeRef: ComputedRef<LGraphNode | null>,
  isGLSLNode: ComputedRef<boolean>,
  isGLSLSubgraphNode: ComputedRef<boolean>,
  lastError: Ref<string | null>,
  isActiveOut: Ref<boolean>,
  hideExecutedOutput: Ref<boolean>
): () => void {
  const widgetValueStore = useWidgetValueStore()
  const nodeOutputStore = useNodeOutputStore()
  const { nodeToNodeLocatorId } = useWorkflowStore()

  let renderer: ReturnType<typeof useGLSLRenderer> | null = null
  let rendererReady = false
  let renderRequestId = 0

  const innerGLSLNode = (() => {
    const node = nodeRef.value
    if (!node?.isSubgraphNode()) return null
    const subgraph = node.subgraph as Subgraph | undefined
    const shaders =
      subgraph?.nodes.filter((n) => n.type === GLSL_NODE_TYPE) ?? []
    return shaders.length === 1 ? shaders[0] : null
  })()

  const ownerSubgraphNode = (() => {
    const node = nodeRef.value
    const graph = node?.graph
    if (!graph) return null
    const rootGraph = graph.rootGraph
    if (!rootGraph || graph === rootGraph) return null

    return (
      rootGraph._nodes?.find(
        (n) => n.isSubgraphNode() && n.subgraph === graph
      ) ?? null
    )
  })()

  const graphId = computed(
    () => nodeRef.value?.graph?.rootGraph?.id as UUID | undefined
  )

  const nodeId = computed(() => {
    const id = nodeRef.value?.id
    return id == null ? undefined : id
  })

  const hasExecutionOutput = computed(() => {
    const node = nodeRef.value
    if (!node) return false

    const outputs = nodeOutputStore.nodeOutputs

    const locatorId = nodeToNodeLocatorId(node)
    if (outputs[locatorId]?.images?.length) return true

    const inner = innerGLSLNode
    if (inner) {
      const innerLocatorId = nodeToNodeLocatorId(inner)
      if (outputs[innerLocatorId]?.images?.length) return true
    }

    return false
  })

  const shouldRender = computed(
    () =>
      (isGLSLNode.value || isGLSLSubgraphNode.value) && hasExecutionOutput.value
  )

  watch(
    shouldRender,
    (v) => {
      isActiveOut.value = v
    },
    { immediate: true }
  )

  const shaderSource = computed(() => {
    const gId = graphId.value
    if (!gId) return undefined

    if (isGLSLNode.value) {
      const nId = nodeId.value
      if (nId == null) return undefined
      return widgetValueStore.getWidget(widgetId(gId, nId, 'fragment_shader'))
        ?.value as string | undefined
    }

    const inner = innerGLSLNode
    if (inner) {
      return widgetValueStore.getWidget(
        widgetId(gId, inner.id, 'fragment_shader')
      )?.value as string | undefined
    }

    return undefined
  })

  const rendererConfig = computed(() => {
    const inner = innerGLSLNode
    if (inner) return getAutogrowLimits(inner)

    const node = nodeRef.value
    if (!node)
      return {
        maxInputs: 5,
        maxFloatUniforms: 20,
        maxIntUniforms: 20,
        maxBoolUniforms: 10,
        maxCurves: 4
      }
    return getAutogrowLimits(node)
  })

  const uniformSources = computed(() => {
    const node = nodeRef.value
    const inner = innerGLSLNode
    if (!node?.isSubgraphNode() || !inner) return null
    return extractUniformSources(inner, node.subgraph as Subgraph, node)
  })

  const { floatValues, intValues, boolValues, curveValues } = useGLSLUniforms(
    graphId,
    nodeId,
    nodeRef,
    uniformSources,
    rendererConfig
  )

  async function resolveSlotImage(
    node: LGraphNode,
    slot: number
  ): Promise<InputImage | null> {
    const upstreamNode = node.getInputNode(slot)
    if (upstreamNode?.imgs?.length) return upstreamNode.imgs[0]

    if (upstreamNode) {
      const url = nodeOutputStore.getNodeImageUrls(upstreamNode)?.[0]
      if (url) return await loadImageFromUrl(url)
    }

    const owner = ownerSubgraphNode
    if (owner) return getImageThroughSubgraphBoundary(node, slot, owner) ?? null

    return null
  }

  // Images are indexed by image-slot ordinal (null for an unresolved slot) so
  // each stays aligned to its u_image{i} sampler. Compacting would bind a later
  // input's image to an earlier sampler when a slot fails to resolve.
  async function resolveInputImages(): Promise<{
    images: (InputImage | null)[]
    expected: number
  }> {
    const node = nodeRef.value
    if (!node?.inputs) return { images: [], expected: 0 }

    const images: (InputImage | null)[] = []
    let expected = 0
    for (let slot = 0; slot < node.inputs.length; slot++) {
      const input = node.inputs[slot]
      const isImageInput = isGLSLSubgraphNode.value
        ? input.type === 'IMAGE'
        : input.name.startsWith('images.image')
      if (!isImageInput) continue
      if (input.link != null) expected++

      images.push(await resolveSlotImage(node, slot))
    }
    return { images, expected }
  }

  const customResolution = computed((): [number, number] | null => {
    const gId = graphId.value
    if (!gId) return null

    const sizeModeNodeId = innerGLSLNode ? innerGLSLNode.id : nodeId.value
    if (sizeModeNodeId == null) return null

    const sizeMode = widgetValueStore.getWidget(
      widgetId(gId, sizeModeNodeId, 'size_mode')
    )
    if (sizeMode?.value !== 'custom') return null

    const widthWidget = widgetValueStore.getWidget(
      widgetId(gId, sizeModeNodeId, 'size_mode.width')
    )
    const heightWidget = widgetValueStore.getWidget(
      widgetId(gId, sizeModeNodeId, 'size_mode.height')
    )
    if (!widthWidget || !heightWidget) return null

    return clampResolution(
      normalizeDimension(widthWidget.value),
      normalizeDimension(heightWidget.value)
    )
  })

  function getResolution(images: InputImage[]): [number, number] {
    const custom = customResolution.value
    if (custom) return custom

    const img = images[0]
    if (img) {
      const w = img instanceof ImageBitmap ? img.width : img.naturalWidth
      const h = img instanceof ImageBitmap ? img.height : img.naturalHeight
      return clampResolution(w || DEFAULT_SIZE, h || DEFAULT_SIZE)
    }

    return [DEFAULT_SIZE, DEFAULT_SIZE]
  }

  let disposed = false
  let lastRendererConfig: GLSLRendererConfig | null = null

  function revokePreview(): void {
    const inner = innerGLSLNode
    if (inner) {
      nodeOutputStore.revokePreviewsByLocatorId(nodeToNodeLocatorId(inner))
      return
    }
    const node = nodeRef.value
    if (node)
      nodeOutputStore.revokePreviewsByLocatorId(nodeToNodeLocatorId(node))
  }

  function ensureRenderer(): ReturnType<typeof useGLSLRenderer> {
    const config = rendererConfig.value
    if (renderer && lastRendererConfig) {
      const changed =
        config.maxInputs !== lastRendererConfig.maxInputs ||
        config.maxFloatUniforms !== lastRendererConfig.maxFloatUniforms ||
        config.maxIntUniforms !== lastRendererConfig.maxIntUniforms ||
        config.maxBoolUniforms !== lastRendererConfig.maxBoolUniforms ||
        config.maxCurves !== lastRendererConfig.maxCurves
      if (changed) {
        renderer.dispose()
        renderer = null
        rendererReady = false
      }
    }
    if (!renderer) {
      renderer = useGLSLRenderer(config)
      lastRendererConfig = { ...config }
    }
    return renderer
  }

  async function renderPreview(): Promise<void> {
    const requestId = ++renderRequestId
    const source = shaderSource.value
    if (!source || !shouldRender.value) return

    const { images, expected } = await resolveInputImages()
    if (requestId !== renderRequestId || disposed) return

    const resolved = images.filter((img): img is InputImage => img != null)
    if (expected > 0 && resolved.length === 0) {
      if (isGLSLNode.value) hideExecutedOutput.value = false
      return
    }

    const r = ensureRenderer()

    try {
      const [w, h] = getResolution(resolved)

      if (!rendererReady) {
        if (!r.init(w, h)) {
          lastError.value = 'WebGL2 not available'
          return
        }
        rendererReady = true
      }

      const result = r.compileFragment(source)
      if (!result.success) {
        lastError.value = result.log
        console.warn('[GLSL] shader compilation failed:', result.log)
        return
      }
      lastError.value = null

      r.setResolution(w, h)

      for (let i = 0; i < images.length; i++) {
        const img = images[i]
        if (img) r.bindInputImage(i, img)
      }

      for (let i = 0; i < floatValues.value.length; i++) {
        r.setFloatUniform(i, floatValues.value[i])
      }
      for (let i = 0; i < intValues.value.length; i++) {
        r.setIntUniform(i, intValues.value[i])
      }
      for (let i = 0; i < boolValues.value.length; i++) {
        r.setBoolUniform(i, boolValues.value[i])
      }
      const curves = curveValues.value
      for (let i = 0; i < curves.length; i++) {
        r.bindCurveTexture(i, curveDataToFloatLUT(curves[i]))
      }

      r.render()

      const blob = await r.toBlob()
      if (requestId !== renderRequestId || disposed) return
      const blobUrl = createSharedObjectUrl(blob)
      try {
        const inner = innerGLSLNode
        if (inner) {
          const innerLocatorId = nodeToNodeLocatorId(inner)
          nodeOutputStore.setNodePreviewsByLocatorId(innerLocatorId, [blobUrl])
        } else {
          const nId = nodeId.value
          if (nId != null) {
            nodeOutputStore.setNodePreviewsByNodeId(nId, [blobUrl])
          }
        }
      } finally {
        releaseSharedObjectUrl(blobUrl)
      }
    } catch (error) {
      if (requestId !== renderRequestId) return
      lastError.value =
        error instanceof Error ? error.message : 'Failed to render preview'
    }
  }

  const debouncedRender = debounce((): void => {
    void renderPreview()
  }, DEBOUNCE_MS)

  watch(
    shouldRender,
    (active) => {
      if (isGLSLNode.value) hideExecutedOutput.value = active
      if (active) debouncedRender()
    },
    { immediate: true }
  )

  watch(
    () =>
      [
        floatValues.value,
        intValues.value,
        boolValues.value,
        curveValues.value,
        customResolution.value
      ] as const,
    () => {
      if (shouldRender.value) debouncedRender()
    },
    { deep: true }
  )

  watch(shaderSource, () => {
    if (shouldRender.value) debouncedRender()
  })

  // Return dispose function for the inner tier
  return () => {
    disposed = true
    hideExecutedOutput.value = false
    debouncedRender.cancel()
    renderer?.dispose()
    renderer = null

    revokePreview()
  }
}
