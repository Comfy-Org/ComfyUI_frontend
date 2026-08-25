import type { MaybeRefOrGetter, Ref } from 'vue'
import { computed, ref, toValue } from 'vue'

import { useChainCallback } from '@/composables/functional/useChainCallback'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { Subgraph } from '@/lib/litegraph/src/litegraph'
import { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { useNodeOutputStore } from '@/stores/nodeOutputStore'
import {
  appendNodeExecutionId,
  tryNormalizeNodeExecutionId
} from '@/types/nodeIdentification'

import type { PromotedPreview } from './usePromotedPreviews'
import { getPreviewMediaType } from './usePromotedPreviews'

/**
 * One shared, ever-incrementing version `ref` per {@link Subgraph}, bumped
 * whenever an interior node is added or removed. `subgraph.nodes` itself is
 * a plain, non-reactive array, so {@link useAmbientSubgraphPreviews} reads
 * this alongside it purely to give Vue something reactive to invalidate on.
 */
const topologyVersions = new WeakMap<Subgraph, Ref<number>>()

function useSubgraphTopologyVersion(subgraph: Subgraph): Ref<number> {
  const existing = topologyVersions.get(subgraph)
  if (existing) return existing

  const version = ref(0)
  subgraph.onNodeAdded = useChainCallback(subgraph.onNodeAdded, () => {
    version.value++
  })
  subgraph.onNodeRemoved = useChainCallback(subgraph.onNodeRemoved, () => {
    version.value++
  })
  topologyVersions.set(subgraph, version)
  return version
}

/**
 * Synthetic `sourceWidgetName` for ambient previews, so they share
 * {@link PromotedPreview}'s shape (and the render list's dedup/key logic)
 * without implying a real promoted widget exists.
 */
const AMBIENT_PREVIEW_NAME = '$$ambient-preview'

/**
 * Live-execution previews for a SubgraphNode host, derived directly from
 * each interior node's own streaming preview state.
 *
 * Deliberately independent of `previewExposureStore` and the link-promotion
 * system: it exists so any interior node currently producing a live preview
 * (e.g. a second KSampler nobody promoted) still shows on the expanded host,
 * loosely analogous to how `nodeLocationProgressStates` bubbles up execution
 * progress regardless of promotion — though unlike that store, this only
 * looks at the host's immediate interior nodes and does not recurse into
 * nested subgraphs.
 */
export function useAmbientSubgraphPreviews(
  lgraphNode: MaybeRefOrGetter<LGraphNode | null | undefined>
) {
  const nodeOutputStore = useNodeOutputStore()

  const ambientPreviews = computed((): PromotedPreview[] => {
    const node = toValue(lgraphNode)
    if (!(node instanceof SubgraphNode)) return []
    if (node.isDetached) return []

    const { subgraph } = node
    void useSubgraphTopologyVersion(subgraph).value

    // The host's own id, treated as its (single-segment) execution id — see
    // `usePromotedPreviews`'s identical `hostLocator` construction. Scoping
    // interior lookups to this instance's own execution path, rather than
    // the subgraph definition's shared `NodeLocatorId`, is what keeps two
    // hosts of the same definition from displaying each other's preview.
    const hostExecutionId = tryNormalizeNodeExecutionId(node.id)
    if (!hostExecutionId) return []

    return subgraph.nodes.flatMap((interiorNode): PromotedPreview[] => {
      // Nested subgraph hosts derive their own previews independently.
      if (interiorNode instanceof SubgraphNode) return []
      if (interiorNode.hideOutputImages) return []

      const executionId = appendNodeExecutionId(
        hostExecutionId,
        interiorNode.id
      )
      if (!executionId) return []

      if (
        !nodeOutputStore.getNodePreviewImagesByExecutionId(executionId)?.length
      )
        return []

      const urls = nodeOutputStore.getNodeImageUrlsByExecutionId(
        executionId,
        interiorNode
      )
      if (!urls?.length) return []

      return [
        {
          sourceNodeId: interiorNode.id,
          sourceWidgetName: AMBIENT_PREVIEW_NAME,
          type: getPreviewMediaType(interiorNode),
          urls
        }
      ]
    })
  })

  return { ambientPreviews }
}
