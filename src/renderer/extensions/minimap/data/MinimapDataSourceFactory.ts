import type { LGraph } from '@/lib/litegraph/src/litegraph'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'

import type { IMinimapDataSource } from '../types'
import { LayoutStoreDataSource } from './LayoutStoreDataSource'
import { LiteGraphDataSource } from './LiteGraphDataSource'

/**
 * Picks where the minimap reads node geometry from.
 *
 * Two sources exist because geometry still has two homes: `layoutStore` owns it
 * while the Vue renderer is mounted (it is DOM-measured there), and
 * `node.pos` / `node.size` own it under the legacy canvas. Selecting on the
 * render mode states that reason outright.
 *
 * It deliberately does not infer the mode from whether `layoutStore` happens to
 * hold rows: that coupled the minimap to unrelated seeding decisions, and moving
 * where nodes were seeded silently changed the minimap in every screenshot that
 * contains it.
 *
 * Collapses to one source once geometry is unified (ADR 0008 phase 4a).
 */
export class MinimapDataSourceFactory {
  static create(graph: LGraph | null): IMinimapDataSource {
    return LiteGraph.vueNodesMode
      ? new LayoutStoreDataSource(graph)
      : new LiteGraphDataSource(graph)
  }
}
