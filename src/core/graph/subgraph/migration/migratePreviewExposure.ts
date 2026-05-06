import type { PendingMigrationEntry } from '@/core/graph/subgraph/migration/proxyWidgetMigrationPlanTypes'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { usePreviewExposureStore } from '@/stores/previewExposureStore'
import { createNodeLocatorId } from '@/types/nodeIdentification'

export type MigratePreviewExposureResult =
  | { ok: true; previewName: string }
  | { ok: false; reason: 'missingSourceNode' | 'missingSourceWidget' }

interface MigratePreviewExposureArgs {
  hostNode: SubgraphNode
  entry: PendingMigrationEntry
  /** Pinia store action — pass `usePreviewExposureStore()` from the caller. */
  store: ReturnType<typeof usePreviewExposureStore>
}

/**
 * Project a single legacy preview-shaped proxy entry into the host-scoped
 * {@link usePreviewExposureStore}.
 *
 * For canonical `$$`-prefixed preview names the source widget may be lazily
 * created at first execution; we treat the exposure as metadata-only and do
 * not require the concrete widget to be present yet. For non-`$$` previews
 * (e.g. `videopreview`) the widget must already exist on the source node.
 */
export function migratePreviewExposure(
  args: MigratePreviewExposureArgs
): MigratePreviewExposureResult {
  const { hostNode, entry, store } = args
  const { plan } = entry

  if (plan.kind !== 'previewExposure') {
    throw new Error(`migratePreviewExposure: invalid plan kind ${plan.kind}`)
  }

  const sourceNode = hostNode.subgraph.getNodeById(
    entry.normalized.sourceNodeId
  )
  if (!sourceNode) {
    return { ok: false, reason: 'missingSourceNode' }
  }

  const isCanonicalPseudo = plan.sourcePreviewName.startsWith('$$')
  if (!isCanonicalPseudo) {
    const widget = sourceNode.widgets?.find(
      (w) => w.name === plan.sourcePreviewName
    )
    if (!widget) {
      return { ok: false, reason: 'missingSourceWidget' }
    }
  }

  const hostNodeLocator = createNodeLocatorId(
    hostNode.rootGraph.id,
    hostNode.id
  )
  const added = store.addExposure(hostNode.rootGraph.id, hostNodeLocator, {
    sourceNodeId: entry.normalized.sourceNodeId,
    sourcePreviewName: plan.sourcePreviewName
  })

  return { ok: true, previewName: added.name }
}
