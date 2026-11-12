import { computed } from 'vue'
import type { NodeState } from '@comfyorg/graph-model/nodeState'
import { hasUnpromotedWidgets } from '@/core/graph/subgraph/promotionUtils'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { useGLSLPreview } from '@/renderer/glsl/useGLSLPreview'
import { usePromotedPreviews } from '@/composables/node/usePromotedPreviews'
import { useProcessedWidgets } from '@/renderer/extensions/vueNodes/composables/useProcessedWidgets'
import { useNodeMedia } from '@/renderer/extensions/vueNodes/preview/useNodeMedia'
import { shouldHideLinkedCoreLoadAudioPlayer } from '@/renderer/extensions/vueNodes/utils/linkedCoreMediaUtils'
import { shouldExpand } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'
import {
  stripGraphPrefix,
  useWidgetValueStore
} from '@/stores/widgetValueStore'
import type { LGraphNode } from '@comfyorg/graph-model/entityRegistry'
import type { NodeLocatorId } from '@comfyorg/graph-model/nodeIdentification'
import type { Ref } from 'vue'

export function useGraphNodeWidgets(
  nodeData: Readonly<Ref<NodeState>>,
  lgraphNode: Readonly<Ref<LGraphNode | null>>,
  nodeLocatorId: Readonly<Ref<NodeLocatorId | undefined>>
) {
  const canvasStore = useCanvasStore()
  const settingStore = useSettingStore()
  const { promotedPreviews } = usePromotedPreviews(lgraphNode)

  const { hideExecutedOutput } = useGLSLPreview(lgraphNode)

  const widgetValueStore = useWidgetValueStore()

  const widgetIds = computed(() => {
    const graphId = canvasStore.rootGraphId
    const bareNodeId = stripGraphPrefix(nodeData.value.id)
    if (!graphId || !bareNodeId) return []

    return widgetValueStore.getNodeWidgetIds(graphId, bareNodeId)
  })

  const renderedWidgetIds = computed(() => {
    const node = lgraphNode.value
    if (!node || !shouldHideLinkedCoreLoadAudioPlayer(node))
      return widgetIds.value

    return widgetIds.value.filter((id) => {
      const widget = widgetValueStore.getWidget(id)
      return widget?.name !== 'audioUI' || widget.type !== 'audioUI'
    })
  })

  const hasRenderableWidgets = computed(
    () => renderedWidgetIds.value.length > 0
  )

  const { canSelectInputs, nodeType, processedWidgets } = useProcessedWidgets(
    () => nodeData.value,
    () => renderedWidgetIds.value
  )

  const processedWidgetModel = computed(() => ({
    processedWidgets: processedWidgets.value,
    nodeType: nodeType.value,
    canSelectInputs: canSelectInputs.value
  }))

  const hasExpandingWidget = computed(() =>
    processedWidgets.value.some(
      (widget) => widget.visible && shouldExpand(widget.simplified.type)
    )
  )

  const showAdvancedInputsButton = computed(() => {
    const node = lgraphNode.value
    if (!node) return false
    if (nodeData.value.flags.collapsed) return false
    if (node instanceof SubgraphNode) {
      return hasUnpromotedWidgets(node)
    }

    const hasAdvancedWidgets = widgetIds.value.some((id) => {
      const visibility = widgetValueStore.getWidgetVisibility(id)
      if (visibility) return visibility.surfaces.vueNode === 'advanced'
      return widgetValueStore.getWidget(id)?.options.advanced
    })
    const alwaysShowAdvanced = settingStore.get(
      'Comfy.Node.AlwaysShowAdvancedWidgets'
    )
    return hasAdvancedWidgets && !alwaysShowAdvanced
  })

  const nodeMedia = useNodeMedia({
    node: lgraphNode,
    locatorId: nodeLocatorId,
    hidden: hideExecutedOutput,
    videoInput: () =>
      nodeData.value.inputs.some((input) => input.type === 'VIDEO'),
    widgetIds
  })

  return {
    promotedPreviews,
    hasRenderableWidgets,
    processedWidgetModel,
    hasExpandingWidget,
    showAdvancedInputsButton,
    nodeMedia
  }
}
