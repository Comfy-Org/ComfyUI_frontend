import { debounce } from 'es-toolkit/compat'
import { computed, onScopeDispose, ref, toValue, watch } from 'vue'

import type { MaybeRefOrGetter } from 'vue'
import type { LGraphNode, NodeId } from '@/lib/litegraph/src/LGraphNode'
import type { UUID } from '@/lib/litegraph/src/utils/uuid'
import { useNodeOutputStore } from '@/stores/imagePreviewStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

import { useGLSLRenderer } from '@/renderer/glsl/useGLSLRenderer'

const GLSL_NODE_TYPE = 'GLSLShader'
const DEBOUNCE_MS = 50
const DEFAULT_SIZE = 512

export function useGLSLPreview(
  nodeMaybe: MaybeRefOrGetter<LGraphNode | null | undefined>
) {
  const lastError = ref<string | null>(null)
  const widgetValueStore = useWidgetValueStore()
  const nodeOutputStore = useNodeOutputStore()

  const renderer = useGLSLRenderer()
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

  const floatValues = computed(() => {
    const gId = graphId.value
    const nId = nodeId.value
    if (!gId || nId == null) return []

    const values: number[] = []
    for (let i = 0; i < 5; i++) {
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
    for (let i = 0; i < 5; i++) {
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
    if (!node?.inputs) return

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
      return [
        img.naturalWidth || DEFAULT_SIZE,
        img.naturalHeight || DEFAULT_SIZE
      ]
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
        return [
          Number(widthWidget.value) || DEFAULT_SIZE,
          Number(heightWidget.value) || DEFAULT_SIZE
        ]
      }
    }

    return [DEFAULT_SIZE, DEFAULT_SIZE]
  }

  async function renderPreview(): Promise<void> {
    const source = shaderSource.value
    if (!source || !isActive.value) return

    if (!rendererReady) {
      const [w, h] = getResolution()
      if (!renderer.init(w, h)) {
        lastError.value = 'WebGL2 not available'
        return
      }
      rendererReady = true
    }

    const result = renderer.compileFragment(source)
    if (!result.success) {
      lastError.value = result.log
      return
    }
    lastError.value = null

    const [w, h] = getResolution()
    renderer.setResolution(w, h)

    loadInputImages()

    for (let i = 0; i < floatValues.value.length; i++) {
      renderer.setFloatUniform(i, floatValues.value[i])
    }
    for (let i = 0; i < intValues.value.length; i++) {
      renderer.setIntUniform(i, intValues.value[i])
    }

    renderer.render()

    const blob = await renderer.toBlob()
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
    renderer.dispose()
  }

  onScopeDispose(dispose)

  return {
    isActive,
    lastError,
    dispose
  }
}
