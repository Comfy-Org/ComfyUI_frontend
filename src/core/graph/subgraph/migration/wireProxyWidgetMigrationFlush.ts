import { flushProxyWidgetMigration } from '@/core/graph/subgraph/migration/proxyWidgetMigrationFlush'
import { setSubgraphMigrationFlushHook } from '@/lib/litegraph/src/subgraph/subgraphMigrationHook'

/**
 * Register the proxyWidget migration flush as the late-bound hook that
 * `LGraph.configure()` calls for every host SubgraphNode it materializes.
 *
 * Called once during app initialization. Safe to call multiple times — the
 * registry holds a single function reference.
 */
export function wireProxyWidgetMigrationFlush(): void {
  setSubgraphMigrationFlushHook(({ hostNode, nodeData }) => {
    flushProxyWidgetMigration({
      hostNode,
      hostWidgetValues: nodeData?.widgets_values
    })
  })
}
