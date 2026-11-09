import { distributeSpace } from '@/lib/litegraph/src/utils/spaceDistribution'
import type { WidgetGridItem } from '@/renderer/extensions/vueNodes/types/widgetGrid'
import { shouldExpand } from '@/renderer/extensions/vueNodes/widgets/registry/widgetRegistry'

export function isGrowableWidgetRow(
  widget: Pick<WidgetGridItem, 'simplified' | 'sizing'>
): boolean {
  return shouldExpand(widget.simplified.type, widget.sizing)
}

/** Splits the body height left after fixed rows among growable rows, floored at each row's declared minimum. */
export function distributeOwnedHeights(
  availableHeight: number,
  rows: readonly Pick<WidgetGridItem, 'sizing'>[]
): number[] {
  return distributeSpace(
    availableHeight,
    rows.map(({ sizing }) =>
      sizing?.kind === 'growable'
        ? { minSize: sizing.minHeight, maxSize: sizing.maxHeight }
        : { minSize: 0 }
    )
  )
}

/** A track that renders the owned height, but collapses to its content minimum while the node measures itself with `--node-height: 0px`. */
export function ownedHeightTrack(height: number): string {
  return `minmax(min-content, min(var(--node-height, ${height}px), ${height}px))`
}
