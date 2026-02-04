import { computed, toValue } from 'vue'

import type { VueNodeData } from '@/composables/graph/useGraphNodeManager'
import { useNodePricing } from '@/composables/node/useNodePricing'
import { usePriceBadge } from '@/composables/node/usePriceBadge'
import type { NodeBadgeProps } from '@/renderer/extensions/vueNodes/components/NodeBadge.vue'
import { useWidgetValueStore } from '@/stores/widgetValueStore'

function splitAroundFirstSpace(text: string): [string, string | undefined] {
  const index = text.indexOf(' ')
  if (index === -1) return [text, undefined]
  return [text.slice(0, index), text.slice(index + 1)]
}

export function usePartitionedBadges(nodeData: VueNodeData) {
  // Use per-node pricing revision to re-compute badges only when this node's pricing updates
  const {
    getRelevantWidgetNames,
    hasDynamicPricing,
    getInputGroupPrefixes,
    getInputNames,
    getNodeRevisionRef
  } = useNodePricing()

  const { isCreditsBadge } = usePriceBadge()

  // Cache pricing metadata (won't change during node lifetime)
  const isDynamicPricing = computed(() =>
    nodeData?.apiNode ? hasDynamicPricing(nodeData.type) : false
  )
  const relevantPricingWidgets = computed(() =>
    nodeData?.apiNode ? getRelevantWidgetNames(nodeData.type) : []
  )
  const inputGroupPrefixes = computed(() =>
    nodeData?.apiNode ? getInputGroupPrefixes(nodeData.type) : []
  )
  const relevantInputNames = computed(() =>
    nodeData?.apiNode ? getInputNames(nodeData.type) : []
  )
  const unpartitionedBadges = computed<NodeBadgeProps[]>(() => {
    // For ALL API nodes: access per-node revision ref to detect when async pricing evaluation completes
    // This is needed even for static pricing because JSONata 2.x evaluation is async
    if (nodeData?.apiNode && nodeData?.id != null) {
      // Access per-node revision ref to establish dependency (each node has its own ref)
      void getNodeRevisionRef(nodeData.id).value

      // For dynamic pricing, also track widget values and input connections
      if (isDynamicPricing.value) {
        // Access only the widget values that affect pricing (from widgetValueStore)
        const relevantNames = relevantPricingWidgets.value
        const widgetStore = useWidgetValueStore()
        if (relevantNames.length > 0 && nodeData?.id != null) {
          for (const name of relevantNames) {
            // Access value from store to create reactive dependency
            void widgetStore.getWidget(nodeData.id, name)?.value
          }
        }
        // Access input connections for regular inputs
        const inputNames = relevantInputNames.value
        if (inputNames.length > 0) {
          nodeData?.inputs?.forEach((inp) => {
            if (inp.name && inputNames.includes(inp.name)) {
              void inp.link // Access link to create reactive dependency
            }
          })
        }
        // Access input connections for input_groups (e.g., autogrow inputs)
        const groupPrefixes = inputGroupPrefixes.value
        if (groupPrefixes.length > 0) {
          nodeData?.inputs?.forEach((inp) => {
            if (
              groupPrefixes.some((prefix) => inp.name?.startsWith(prefix + '.'))
            ) {
              void inp.link // Access link to create reactive dependency
            }
          })
        }
      }
    }
    return [...(nodeData?.badges ?? [])].map(toValue)
  })
  return computed(() => {
    let hasComfyBadge = false
    const core: NodeBadgeProps[] = []
    const extension: NodeBadgeProps[] = []
    const pricing: { required: string; rest?: string }[] = []
    for (const badge of unpartitionedBadges.value) {
      if (badge.text[0] === '#' && badge.bgColor === '#0F1F0F') {
        const [id, source] = splitAroundFirstSpace(badge.text)
        core.push({ text: id })

        if (source === '🦊') hasComfyBadge = true
        else if (source) core.push({ text: source })

        continue
      }
      if (isCreditsBadge(badge)) {
        pricing.push({ text: badge.text })
        continue
      }
      extension.push(badge)
    }
    return { hasComfyBadge, core, extension, pricing }
  })
}
