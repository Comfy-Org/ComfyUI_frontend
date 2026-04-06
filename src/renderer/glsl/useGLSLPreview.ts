import { debounce } from 'es-toolkit/compat'
import { computed, effectScope, onScopeDispose, ref, toValue, watch } from 'vue'

import type { ComputedRef, EffectScope, MaybeRefOrGetter, Ref } from 'vue'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

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
            isActive
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
function createInnerPreview(
  nodeRef: ComputedRef<LGraphNode | null>,
  isGLSLNode: ComputedRef<boolean>,
  isGLSLSubgraphNode: ComputedRef<boolean>,
  lastError: Ref<string | null>,
  isActiveOut: Ref<boolean>
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
    return subgraph?.nodes.find((n) => n.type === GLSL_NODE_TYPE) ?? null
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

  const nodeId = computed(() => nodeRef.value?.id as NodeId | undefined)

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
      return widgetValueStore.getWidget(gId, nId, 'fragment_shader')?.value as
        | string
        | undefined
    }

    const inner = innerGLSLNode
    if (inner) {
      return widgetValueStore.getWidget(
        gId,
        inner.id as NodeId,
        'fragment_shader'
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
    return extractUniformSources(inner, node.subgraph as Subgraph)
  })

  const { floatValues, intValues, boolValues, curveValues } = useGLSLUniforms(
    graphId,
    nodeId,
    nodeRef,
    uniformSources,
    rendererConfig
  )

  function loadInputImages(): void {
    const node = nodeRef.value
    if (!node?.inputs || !renderer) return

    if (isGLSLSubgraphNode.value) {
      let imageSlotIndex = 0
      for (let slot = 0; slot < node.inputs.length; slot++) {
        if (node.inputs[slot].type !== 'IMAGE') continue
        const upstreamNode = node.getInputNode(slot)
        if (upstreamNode?.imgs?.length) {
          renderer.bindInputImage(imageSlotIndex, upstreamNode.imgs[0])
        }
        imageSlotIndex++
      }
      return
    }

    let imageSlotIndex = 0
    for (let slot = 0; slot < node.inputs.length; slot++) {
      const input = node.inputs[slot]
      if (!input.name.startsWith('images.image')) continue

      const upstreamNode = node.getInputNode(slot)
      if (upstreamNode?.imgs?.length) {
        renderer.bindInputImage(imageSlotIndex, upstreamNode.imgs[0])
        imageSlotIndex++
        continue
      }

      const owner = ownerSubgraphNode
      if (owner) {
        const img = getImageThroughSubgraphBoundary(node, slot, owner)
        if (img) {
          renderer.bindInputImage(imageSlotIndex, img)
        }
      }
      imageSlotIndex++
    }
  }

  function getResolution(): [number, number] {
    const node = nodeRef.value
    if (!node?.inputs) return [DEFAULT_SIZE, DEFAULT_SIZE]

    if (isGLSLSubgraphNode.value) {
      for (let slot = 0; slot < node.inputs.length; slot++) {
        if (node.inputs[slot].type !== 'IMAGE') continue
        const upstreamNode = node.getInputNode(slot)
        if (!upstreamNode?.imgs?.length) continue
        const img = upstreamNode.imgs[0]
        return clampResolution(
          img.naturalWidth || DEFAULT_SIZE,
          img.naturalHeight || DEFAULT_SIZE
        )
      }
      return [DEFAULT_SIZE, DEFAULT_SIZE]
    }

    for (let slot = 0; slot < node.inputs.length; slot++) {
      const input = node.inputs[slot]
      if (!input.name.startsWith('images.image')) continue

      const upstreamNode = node.getInputNode(slot)
      if (upstreamNode?.imgs?.length) {
        const img = upstreamNode.imgs[0]
        return clampResolution(
          img.naturalWidth || DEFAULT_SIZE,
          img.naturalHeight || DEFAULT_SIZE
        )
      }

      const owner = ownerSubgraphNode
      if (owner) {
        const img = getImageThroughSubgraphBoundary(node, slot, owner)
        if (img) {
          return clampResolution(
            img.naturalWidth || DEFAULT_SIZE,
            img.naturalHeight || DEFAULT_SIZE
          )
        }
      }
    }

    const gId = graphId.value
    const nId = nodeId.value
    if (gId && nId != null) {
      const widthWidget = widgetValueStore.getWidget(
        gId,
        nId,
        'size_mode.width'
      )
      const heightWidget = widgetValueStore.getWidget(
        gId,
        nId,
        'size_mode.height'
      )
      if (widthWidget && heightWidget) {
        return clampResolution(
          normalizeDimension(widthWidget.value),
          normalizeDimension(heightWidget.value)
        )
      }
    }

    return [DEFAULT_SIZE, DEFAULT_SIZE]
  }

  let disposed = false
  let lastRendererConfig: GLSLRendererConfig | null = null

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

    const r = ensureRenderer()

    try {
      if (!rendererReady) {
        const [w, h] = getResolution()
        if (!r.init(w, h)) {
          lastError.value = 'WebGL2 not available'
          return
        }
        rendererReady = true
      }

      const result = r.compileFragment(source)
      if (!result.success) {
        lastError.value = result.log
        return
      }
      lastError.value = null

      const [w, h] = getResolution()
      r.setResolution(w, h)

      loadInputImages()

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
      if (isGLSLNode.value) {
        const node = nodeRef.value
        if (node) node.hideOutputImages = active
      }
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
        curveValues.value
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
    debouncedRender.cancel()
    renderer?.dispose()
    renderer = null

    // Revoke preview blob URLs to avoid memory leaks
    const inner = innerGLSLNode
    if (inner) {
      const locatorId = nodeToNodeLocatorId(inner)
      nodeOutputStore.revokePreviewsByLocatorId(locatorId)
    } else {
      const nId = nodeId.value
      if (nId != null) {
        const locatorId = nodeToNodeLocatorId(nodeRef.value!)
        nodeOutputStore.revokePreviewsByLocatorId(locatorId)
      }
    }
  }
}
