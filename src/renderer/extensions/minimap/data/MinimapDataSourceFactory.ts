import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'

import type { IMinimapDataSource } from '../types'
import { LayoutStoreDataSource } from './LayoutStoreDataSource'
import { LiteGraphDataSource } from './LiteGraphDataSource'

/**
 * Node geometry has two homes: `layoutStore` under the Vue renderer,
 * `node.pos` / `node.size` under the legacy canvas. Collapses to one source once
 * geometry is unified (ADR 0008 phase 4a).
 */
export class MinimapDataSourceFactory {
  static create(graph: LGraph | null): IMinimapDataSource {
    return LiteGraph.vueNodesMode
      ? new LayoutStoreDataSource(graph)
      : new LiteGraphDataSource(graph)
  }
}
