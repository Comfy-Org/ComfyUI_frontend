import { trim } from 'es-toolkit'
import { computed, toValue } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useNodePricing } from '@/composables/node/useNodePricing'
import { usePriceBadge } from '@/composables/node/usePriceBadge'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { INodeInputSlot } from '@/lib/litegraph/src/interfaces'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { NodeBadgeProps } from '@/renderer/extensions/vueNodes/components/NodeBadge.vue'
import { useCanvasStore } from '@/renderer/core/canvas/canvasStore'
import { app } from '@/scripts/app'
import { useLinkStore } from '@/stores/linkStore'
import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import { toNodeId } from '@/types/nodeId'
import type { NodeId, SerializedNodeId } from '@/types/nodeId'
import { NodeBadgeMode } from '@/types/nodeSource'
import { widgetId } from '@/types/widgetId'
import type { UUID } from '@/utils/uuid'

function splitAroundFirstSpace(text: string): [string, string | undefined] {
  const index = text.indexOf(' ')
  if (index === -1) return [text, undefined]
  return [text.slice(0, index), text.slice(index + 1)]
}

type TrackableNode = {
  id: SerializedNodeId
  type: string
  inputs?: INodeInputSlot[]
}

/**
 * Reads pricing-relevant slot connectivity from the link store so the
 * calling computed re-runs when one of those inputs connects or disconnects.
 */
function touchPricingInputConnectivity(
  graphId: UUID | undefined,
  nodeId: NodeId,
  inputs: INodeInputSlot[] | undefined,
  inputNames: string[],
  groupPrefixes: string[]
): void {
  if (graphId === undefined || !inputs) return
  if (inputNames.length === 0 && groupPrefixes.length === 0) return

  const linkStore = useLinkStore()
  inputs.forEach((inp, index) => {
    const relevant =
      (inp.name && inputNames.includes(inp.name)) ||
      groupPrefixes.some((prefix) => inp.name?.startsWith(prefix + '.'))
    if (relevant) void linkStore.isInputSlotConnected(graphId, nodeId, index)
  })
}
export function trackNodePrice(node: TrackableNode) {
  const {
    getRelevantWidgetNames,
    hasDynamicPricing,
    getInputGroupPrefixes,
    getInputNames,
    getNodeRevisionRef
  } = useNodePricing()
  // Read the per-node revision ref even for static pricing: JSONata 2.x
  // evaluation is async, so the badge must re-run when evaluation completes.
  const nodeId = toNodeId(node.id)
  void getNodeRevisionRef(nodeId).value

  if (!hasDynamicPricing(node.type)) return

  // Access only the widget values that affect pricing (from widgetValueStore)
  const relevantNames = getRelevantWidgetNames(node.type)
  const widgetStore = useWidgetValueStore()
  const graphId = useCanvasStore().rootGraphId
  if (relevantNames.length > 0 && node.id != null) {
    for (const name of relevantNames) {
      // Access value from store to create reactive dependency
      if (!graphId) continue
      void widgetStore.getWidget(widgetId(graphId, nodeId, name))?.value
    }
  }
  touchPricingInputConnectivity(
    graphId,
    nodeId,
    node.inputs,
    getInputNames(node.type),
    getInputGroupPrefixes(node.type)
  )
}

/**
 * Register reactive deps on every contained api node's pricing inputs so the
 * SubgraphNode wrapper's badge computed re-runs when an inner (e.g. promoted)
 * widget value changes. Also tracks the wrapper's own promoted widget host
 * values so user edits on the wrapper trigger re-evaluation.
 */
function trackSubgraphInnerNodePrices(wrapper: LGraphNode) {
  if (!wrapper.isSubgraphNode()) return
  // Touch each promoted widget's host value to register reactive deps.
  for (const w of wrapper.widgets ?? []) void w.value

  const visited = new Set<string>()
  function walk(nodes: LGraphNode[]) {
    for (const inner of nodes) {
      if (inner.isSubgraphNode()) {
        const id = String(inner.subgraph.id)
        if (visited.has(id)) continue
        visited.add(id)
        walk(inner.subgraph.nodes)
        continue
      }
      if (!inner.constructor?.nodeData?.api_node) continue
      trackNodePrice({
        id: inner.id,
        type: inner.type ?? '',
        inputs: inner.inputs
      })
    }
  }
  walk(wrapper.subgraph.nodes)
}

export function usePartitionedBadges(nodeData: VueNodeData) {
  const { isCreditsBadge } = usePriceBadge()
  const settingStore = useSettingStore()

  const unpartitionedBadges = computed<NodeBadgeProps[]>(() => {
    if (nodeData?.id != null) {
      const wrapper = app.canvas?.graph?.getNodeById(nodeData.id)
      if (wrapper?.isSubgraphNode()) trackSubgraphInnerNodePrices(wrapper)
    }
    if (nodeData?.apiNode && nodeData?.id != null) trackNodePrice(nodeData)
    return [...(nodeData?.badges ?? [])].map(toValue)
  })
  const nodeDef = useNodeDefStore().nodeDefsByName[nodeData.type]
  return computed(() => {
    const displaySource = settingStore.get(
      'Comfy.NodeBadge.NodeSourceBadgeMode'
    )
    const isCoreNode =
      nodeDef?.isCoreNode && displaySource === NodeBadgeMode.ShowAll
    const core: NodeBadgeProps[] = []
    const extension: NodeBadgeProps[] = []
    const pricing: { required: string; rest?: string }[] = []
    if (
      settingStore.get('Comfy.NodeBadge.NodeLifeCycleBadgeMode') !==
      NodeBadgeMode.None
    ) {
      const lifecycleText = nodeDef?.nodeLifeCycleBadgeText ?? ''
      const trimmed = trim(lifecycleText, ['[', ']'])
      if (trimmed) core.push({ text: trimmed })
    }
    if (
      settingStore.get('Comfy.NodeBadge.NodeIdBadgeMode') !== NodeBadgeMode.None
    )
      core.push({ text: `#${nodeData.id}` })
    const sourceText = nodeDef?.nodeSource?.badgeText
    if (
      !nodeDef?.isCoreNode &&
      displaySource !== NodeBadgeMode.None &&
      sourceText
    )
      core.push({ text: sourceText })

    for (const badge of unpartitionedBadges.value.slice(1)) {
      if (!badge.text) continue

      if (isCreditsBadge(badge)) {
        const [required, rest] = splitAroundFirstSpace(badge.text)
        pricing.push({ required, rest })
        continue
      }
      extension.push(badge)
    }

    return {
      hasComfyBadge: isCoreNode && pricing.length === 0,
      core,
      extension,
      pricing
    }
  })
}
