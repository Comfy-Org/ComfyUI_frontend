import { debounce } from 'es-toolkit/compat'
import { computed, onScopeDispose, ref, toValue, watch } from 'vue'

import type { MaybeRefOrGetter } from 'vue'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import type { GLSLRendererConfig } from '@/renderer/glsl/useGLSLRenderer'
import { useGLSLRenderer } from '@/renderer/glsl/useGLSLRenderer'

const GLSL_NODE_TYPE = 'GLSLShader'
const DEBOUNCE_MS = 50
const DEFAULT_SIZE = 512
const MAX_PREVIEW_DIMENSION = 1024

interface AutogrowGroup {
  max: number
  min: number
  prefix?: string
}

function getAutogrowLimits(node: LGraphNode): GLSLRendererConfig {
  const defaults: GLSLRendererConfig = {
    maxInputs: 5,
    maxFloatUniforms: 5,
    maxIntUniforms: 5
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
    maxIntUniforms: groups['ints']?.max ?? defaults.maxIntUniforms
  }
}

function clampResolution(w: number, h: number): [number, number] {
  const maxDim = Math.max(w, h)
  if (maxDim <= MAX_PREVIEW_DIMENSION) return [w, h]
  const scale = MAX_PREVIEW_DIMENSION / maxDim
  return [Math.round(w * scale), Math.round(h * scale)]
}

export function useGLSLPreview(
  nodeMaybe: MaybeRefOrGetter<LGraphNode | null | undefined>
) {
  const lastError = ref<string | null>(null)
  const widgetValueStore = useWidgetValueStore()
  const nodeOutputStore = useNodeOutputStore()

  let renderer: ReturnType<typeof useGLSLRenderer> | null = null
  let rendererReady = false
  let currentBlobUrl: string | null = null

  const nodeRef = computed(() => toValue(nodeMaybe) ?? null)

  const isGLSLNode = computed(() => nodeRef.value?.type === GLSL_NODE_TYPE)

  const graphId = computed(() => nodeRef.value?.graph?.id as UUID | undefined)

  const nodeId = computed(() => nodeRef.value?.id as NodeId | undefined)

  const hasExecutionOutput = computed(() => {
    const node = nodeRef.value
    if (!node) return false
    return !!nodeOutputStore.getNodeOutputs(node)?.images?.length
  })

  const isActive = computed(() => isGLSLNode.value && hasExecutionOutput.value)

  const shaderSource = computed(() => {
    const gId = graphId.value
    const nId = nodeId.value
    if (!gId || nId == null) return undefined
    return widgetValueStore.getWidget(gId, nId, 'fragment_shader')?.value as
      | string
      | undefined
  })

  const rendererConfig = computed(() => {
    const node = nodeRef.value
    if (!node) return { maxInputs: 5, maxFloatUniforms: 5, maxIntUniforms: 5 }
    return getAutogrowLimits(node)
  })

  const floatValues = computed(() => {
    const gId = graphId.value
    const nId = nodeId.value
    if (!gId || nId == null) return []

    const values: number[] = []
    for (let i = 0; i < rendererConfig.value.maxFloatUniforms; i++) {
      const widget = widgetValueStore.getWidget(gId, nId, `floats.u_float${i}`)
      if (widget === undefined) break
      values.push(Number(widget.value) || 0)
    }
    return values
  })

  const intValues = computed(() => {
    const gId = graphId.value
    const nId = nodeId.value
    if (!gId || nId == null) return []

    const values: number[] = []
    for (let i = 0; i < rendererConfig.value.maxIntUniforms; i++) {
      const widget = widgetValueStore.getWidget(gId, nId, `ints.u_int${i}`)
      if (widget === undefined) break
      values.push(Number(widget.value) || 0)
    }
    return values
  })

  function revokeBlobUrl(): void {
    if (currentBlobUrl) {
      URL.revokeObjectURL(currentBlobUrl)
      currentBlobUrl = null
    }
  }

  function loadInputImages(): void {
    const node = nodeRef.value
    if (!node?.inputs || !renderer) return

    let imageSlotIndex = 0
    for (let slot = 0; slot < node.inputs.length; slot++) {
      const input = node.inputs[slot]
      if (!input.name.startsWith('images.image')) continue

      const upstreamNode = node.getInputNode(slot)
      if (!upstreamNode) continue

      const imgs = upstreamNode.imgs
      if (imgs?.length) {
        renderer.bindInputImage(imageSlotIndex, imgs[0])
      }
      imageSlotIndex++
    }
  }

  function getResolution(): [number, number] {
    const node = nodeRef.value
    if (!node?.inputs) return [DEFAULT_SIZE, DEFAULT_SIZE]

    for (let slot = 0; slot < node.inputs.length; slot++) {
      const input = node.inputs[slot]
      if (!input.name.startsWith('images.image')) continue

      const upstreamNode = node.getInputNode(slot)
      if (!upstreamNode?.imgs?.length) continue

      const img = upstreamNode.imgs[0]
      return clampResolution(
        img.naturalWidth || DEFAULT_SIZE,
        img.naturalHeight || DEFAULT_SIZE
      )
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
          Number(widthWidget.value) || DEFAULT_SIZE,
          Number(heightWidget.value) || DEFAULT_SIZE
        )
      }
    }

    return [DEFAULT_SIZE, DEFAULT_SIZE]
  }

  function ensureRenderer(): ReturnType<typeof useGLSLRenderer> {
    if (!renderer) {
      renderer = useGLSLRenderer(rendererConfig.value)
    }
    return renderer
  }

  async function renderPreview(): Promise<void> {
    const source = shaderSource.value
    if (!source || !isActive.value) return

    const r = ensureRenderer()

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

    r.render()

    const blob = await r.toBlob()
    revokeBlobUrl()
    currentBlobUrl = URL.createObjectURL(blob)

    const nId = nodeId.value
    if (nId != null) {
      nodeOutputStore.setNodePreviewsByNodeId(nId, [currentBlobUrl])
    }
  }

  const debouncedRender = debounce((): void => {
    void renderPreview()
  }, DEBOUNCE_MS)

  watch(
    () => [floatValues.value, intValues.value] as const,
    () => {
      if (isActive.value) debouncedRender()
    },
    { deep: true }
  )

  watch(shaderSource, () => {
    if (isActive.value) debouncedRender()
  })

  function dispose(): void {
    debouncedRender.cancel()
    revokeBlobUrl()
    renderer?.dispose()
  }

  onScopeDispose(dispose)

  return {
    isActive,
    lastError,
    dispose
  }
}
