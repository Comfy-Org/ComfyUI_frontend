import { debounce } from 'es-toolkit/compat'
import { computed, effectScope, onScopeDispose, ref, toValue, watch } from 'vue'

import type { ComputedRef, EffectScope, MaybeRefOrGetter, Ref } from 'vue'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import { SUBGRAPH_INPUT_ID } from '@/lib/litegraph/src/constants'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import type { CurveData } from '@/components/curve/types'
import { createInterpolator, isCurveData } from '@/components/curve/curveUtils'
import type { GLSLRendererConfig } from '@/renderer/glsl/useGLSLRenderer'
import { useGLSLRenderer } from '@/renderer/glsl/useGLSLRenderer'
import {
  createSharedObjectUrl,
  releaseSharedObjectUrl
} from '@/utils/objectUrlUtil'

const GLSL_NODE_TYPE = 'GLSLShader'
const DEBOUNCE_MS = 50
const DEFAULT_SIZE = 512
const MAX_PREVIEW_DIMENSION = 1024
const CURVE_LUT_SIZE = 256

interface AutogrowGroup {
  max: number
  min: number
  prefix?: string
}

interface UniformSource {
  nodeId: NodeId
  widgetName: string
}

function getAutogrowLimits(node: LGraphNode): GLSLRendererConfig {
  const defaults: GLSLRendererConfig = {
    maxInputs: 5,
    maxFloatUniforms: 20,
    maxIntUniforms: 20,
    maxBoolUniforms: 10,
    maxCurves: 4
  }

  if (!('comfyDynamic' in node)) return defaults

  const dynamic = node.comfyDynamic
  if (
    typeof dynamic !== 'object' ||
    dynamic === null ||
    !('autogrow' in dynamic)
  )
    return defaults

  const groups = dynamic.autogrow as Record<string, AutogrowGroup> | undefined
  if (!groups) return defaults

  return {
    maxInputs: groups['images']?.max ?? defaults.maxInputs,
    maxFloatUniforms: groups['floats']?.max ?? defaults.maxFloatUniforms,
    maxIntUniforms: groups['ints']?.max ?? defaults.maxIntUniforms,
    maxBoolUniforms: groups['bools']?.max ?? defaults.maxBoolUniforms,
    maxCurves: groups['curves']?.max ?? defaults.maxCurves
  }
}

function normalizeDimension(value: unknown): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_SIZE
  return parsed
}

function clampResolution(w: number, h: number): [number, number] {
  const maxDim = Math.max(w, h)
  if (maxDim <= MAX_PREVIEW_DIMENSION) return [w, h]
  const scale = MAX_PREVIEW_DIMENSION / maxDim
  return [Math.round(w * scale), Math.round(h * scale)]
}

function curveDataToLUT(curve: CurveData): Float32Array {
  const lut = new Float32Array(CURVE_LUT_SIZE)
  const interpolate = createInterpolator(curve.points, curve.interpolation)
  for (let i = 0; i < CURVE_LUT_SIZE; i++) {
    lut[i] = interpolate(i / (CURVE_LUT_SIZE - 1))
  }
  return lut
}

function getImageThroughSubgraphBoundary(
  node: LGraphNode,
  slot: number,
  ownerSubgraphNode: LGraphNode
): HTMLImageElement | undefined {
  const graph = node.graph
  if (!graph) return undefined

  const input = node.inputs[slot]
  if (input?.link == null) return undefined

  const link = graph._links.get(input.link)
  if (!link || link.origin_id !== SUBGRAPH_INPUT_ID) return undefined

  const outerUpstream = ownerSubgraphNode.getInputNode(link.origin_slot)
  if (!outerUpstream?.imgs?.length) return undefined

  return outerUpstream.imgs[0]
}

function extractUniformSources(
  glslNode: LGraphNode,
  subgraph: Subgraph
): {
  floats: UniformSource[]
  ints: UniformSource[]
  bools: UniformSource[]
  curves: UniformSource[]
} {
  const floats: UniformSource[] = []
  const ints: UniformSource[] = []
  const bools: UniformSource[] = []
  const curves: UniformSource[] = []

  if (!glslNode.inputs) return { floats, ints, bools, curves }

  for (const input of glslNode.inputs) {
    if (input.link == null) continue

    const link = subgraph.getLink(input.link)
    if (!link || link.origin_id === SUBGRAPH_INPUT_ID) continue

    const sourceNode = subgraph.getNodeById(link.origin_id)
    if (!sourceNode?.widgets?.[0]) continue

    const inputName = input.name ?? ''
    const dotIndex = inputName.indexOf('.')
    if (dotIndex === -1) continue

    const prefix = inputName.slice(0, dotIndex)
    const source: UniformSource = {
      nodeId: sourceNode.id as NodeId,
      widgetName: sourceNode.widgets[0].name
    }

    if (prefix === 'floats') floats.push(source)
    else if (prefix === 'ints') ints.push(source)
    else if (prefix === 'bools') bools.push(source)
    else if (prefix === 'curves') curves.push(source)
  }

  return { floats, ints, bools, curves }
}

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

  const innerGLSLNode = computed(() => {
    const node = nodeRef.value
    if (!node?.isSubgraphNode()) return null
    const subgraph = node.subgraph as Subgraph | undefined
    return subgraph?.nodes.find((n) => n.type === GLSL_NODE_TYPE) ?? null
  })

  const ownerSubgraphNode = computed(() => {
    const node = nodeRef.value
    const graph = node?.graph
    if (!graph) return null
    const rootGraph = graph.rootGraph
    if (!rootGraph || graph === rootGraph) return null

    return (
      rootGraph._nodes.find(
        (n) => n.isSubgraphNode() && n.subgraph === graph
      ) ?? null
    )
  })

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

    const inner = innerGLSLNode.value
    if (inner) {
      const innerLocatorId = nodeToNodeLocatorId(inner)
      if (outputs[innerLocatorId]?.images?.length) return true
    }

    return false
  })

  const isActive = computed(
    () =>
      (isGLSLNode.value || isGLSLSubgraphNode.value) && hasExecutionOutput.value
  )

  watch(
    isActive,
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

    const inner = innerGLSLNode.value
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
    const inner = innerGLSLNode.value
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
    const inner = innerGLSLNode.value
    if (!node?.isSubgraphNode() || !inner) return null
    return extractUniformSources(inner, node.subgraph as Subgraph)
  })

  function collectUniformValues(
    subgraphSources: UniformSource[] | undefined,
    groupName: string,
    uniformPrefix: string,
    maxCount: number
  ): number[] {
    const gId = graphId.value
    if (!gId) return []

    if (subgraphSources) {
      return subgraphSources.map(({ nodeId: nId, widgetName }) => {
        const widget = widgetValueStore.getWidget(gId, nId, widgetName)
        return Number(widget?.value ?? 0) || 0
      })
    }

    const nId = nodeId.value
    const node = nodeRef.value
    if (nId == null || !node) return []

    const values: number[] = []
    for (let i = 0; i < maxCount; i++) {
      const inputName = `${groupName}.${uniformPrefix}${i}`
      const widget = widgetValueStore.getWidget(gId, nId, inputName)
      if (widget !== undefined) {
        values.push(Number(widget.value) || 0)
        continue
      }

      const slot = node.inputs?.findIndex((inp) => inp.name === inputName)
      if (slot == null || slot < 0) break

      const upstreamNode = node.getInputNode(slot)
      if (!upstreamNode) break
      const upstreamWidgets = widgetValueStore.getNodeWidgets(
        gId,
        upstreamNode.id as NodeId
      )
      if (upstreamWidgets.length === 0) break
      values.push(Number(upstreamWidgets[0].value) || 0)
    }
    return values
  }

  const floatValues = computed(() =>
    collectUniformValues(
      uniformSources.value?.floats,
      'floats',
      'u_float',
      rendererConfig.value.maxFloatUniforms
    )
  )

  const intValues = computed(() =>
    collectUniformValues(
      uniformSources.value?.ints,
      'ints',
      'u_int',
      rendererConfig.value.maxIntUniforms
    )
  )

  function collectBoolValues(
    subgraphSources: UniformSource[] | undefined,
    maxCount: number
  ): boolean[] {
    const gId = graphId.value
    if (!gId) return []

    if (subgraphSources) {
      return subgraphSources.map(({ nodeId: nId, widgetName }) => {
        const widget = widgetValueStore.getWidget(gId, nId, widgetName)
        return Boolean(widget?.value ?? false)
      })
    }

    const nId = nodeId.value
    const node = nodeRef.value
    if (nId == null || !node) return []

    const values: boolean[] = []
    for (let i = 0; i < maxCount; i++) {
      const inputName = `bools.u_bool${i}`
      const widget = widgetValueStore.getWidget(gId, nId, inputName)
      if (widget !== undefined) {
        values.push(Boolean(widget.value))
        continue
      }

      const slot = node.inputs?.findIndex((inp) => inp.name === inputName)
      if (slot == null || slot < 0) break

      const upstreamNode = node.getInputNode(slot)
      if (!upstreamNode) break
      const upstreamWidgets = widgetValueStore.getNodeWidgets(
        gId,
        upstreamNode.id as NodeId
      )
      if (upstreamWidgets.length === 0) break
      values.push(Boolean(upstreamWidgets[0].value))
    }
    return values
  }

  const boolValues = computed(() =>
    collectBoolValues(
      uniformSources.value?.bools,
      rendererConfig.value.maxBoolUniforms
    )
  )

  const curveValues = computed((): CurveData[] => {
    const gId = graphId.value
    if (!gId) return []

    const sources = uniformSources.value?.curves
    if (sources && sources.length > 0) {
      return sources
        .map(({ nodeId: nId, widgetName }) => {
          const widget = widgetValueStore.getWidget(gId, nId, widgetName)
          return widget && isCurveData(widget.value)
            ? (widget.value as CurveData)
            : null
        })
        .filter((v): v is CurveData => v !== null)
    }

    const node = nodeRef.value
    const nId = nodeId.value
    if (nId == null || !node?.inputs) return []

    const values: CurveData[] = []
    const max = rendererConfig.value.maxCurves
    for (let i = 0; i < max; i++) {
      const inputName = `curves.u_curve${i}`

      const widget = widgetValueStore.getWidget(gId, nId, inputName)
      if (widget && isCurveData(widget.value)) {
        values.push(widget.value as CurveData)
        continue
      }

      const slot = node.inputs.findIndex((inp) => inp.name === inputName)
      if (slot < 0) break

      const upstreamNode = node.getInputNode(slot)
      if (!upstreamNode) break

      const upstreamWidgets = widgetValueStore.getNodeWidgets(
        gId,
        upstreamNode.id as NodeId
      )
      const curveWidget = upstreamWidgets.find((w) => isCurveData(w.value))
      if (!curveWidget) break
      values.push(curveWidget.value as CurveData)
    }
    return values
  })

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

      const owner = ownerSubgraphNode.value
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

      const owner = ownerSubgraphNode.value
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
    if (!source || !isActive.value) return

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
        r.bindCurveTexture(i, curveDataToLUT(curves[i]))
      }

      r.render()

      const blob = await r.toBlob()
      if (requestId !== renderRequestId || disposed) return
      const blobUrl = createSharedObjectUrl(blob)

      const inner = innerGLSLNode.value
      if (inner) {
        const innerLocatorId = nodeToNodeLocatorId(inner)
        nodeOutputStore.setNodePreviewsByLocatorId(innerLocatorId, [blobUrl])
      } else {
        const nId = nodeId.value
        if (nId != null) {
          nodeOutputStore.setNodePreviewsByNodeId(nId, [blobUrl])
        }
      }

      releaseSharedObjectUrl(blobUrl)
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
    isActive,
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
      if (isActive.value) debouncedRender()
    },
    { deep: true }
  )

  watch(shaderSource, () => {
    if (isActive.value) debouncedRender()
  })

  // Return dispose function for the inner tier
  return () => {
    disposed = true
    debouncedRender.cancel()
    renderer?.dispose()
    renderer = null

    // Revoke preview blob URLs to avoid memory leaks
    const inner = innerGLSLNode.value
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
