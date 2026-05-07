import type { ISerialisedNode } from '@/lib/litegraph/src/types/serialisation'

import type { SubgraphNode } from './SubgraphNode'

/**
 * Late-bound hook that runs after a host graph has finished configuring all
 * its nodes and links. Wired in app initialization to {@link
 * flushProxyWidgetMigration}; left undefined in tests that exercise
 * `LGraph.configure` without the migration pipeline.
 *
 * The hook is intentionally untyped at the LGraph layer because importing
 * the flush directly from LGraph would create a circular dependency through
 * the PreviewExposureStore.
 */
type SubgraphMigrationFlushHook = (args: {
  hostNode: SubgraphNode
  nodeData: ISerialisedNode | undefined
}) => void

interface SubgraphMigrationRegistry {
  flush?: SubgraphMigrationFlushHook
}

const registry: SubgraphMigrationRegistry = {}

export function setSubgraphMigrationFlushHook(
  hook: SubgraphMigrationFlushHook | undefined
): void {
  registry.flush = hook
}

export function runSubgraphMigrationFlushHook(
  hostNode: SubgraphNode,
  nodeData: ISerialisedNode | undefined
): void {
  registry.flush?.({ hostNode, nodeData })
}
