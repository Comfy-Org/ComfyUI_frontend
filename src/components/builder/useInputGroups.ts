import { parseInputItemKey } from '@/components/builder/itemKeyHelper'
import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { IBaseWidget } from '@/lib/litegraph/src/types/widgets'
import type { InputGroup } from '@/platform/workflow/management/stores/comfyWorkflow'
import { resolveNodeWidget } from '@/utils/litegraphUtil'

export interface ResolvedGroupItem {
  key: string
  pairId?: string
  node: LGraphNode
  widget: IBaseWidget
  nodeId: string
  widgetName: string
}

/** Row of items to render — single or side-by-side pair. */
export type GroupRow =
  | { type: 'single'; item: ResolvedGroupItem }
  | { type: 'pair'; items: [ResolvedGroupItem, ResolvedGroupItem] }

/** Derive a group name from the labels of its contained widgets. */
export function autoGroupName(group: InputGroup): string {
  const labels: string[] = []
  for (const item of group.items) {
    const parsed = parseInputItemKey(item.key)
    if (!parsed) continue
    const [, widget] = resolveNodeWidget(parsed.nodeId, parsed.widgetName)
    if (widget) labels.push(widget.label || widget.name)
  }
  return labels.join(', ') || t('linearMode.groups.untitled')
}

/**
 * Resolve item keys to widget/node data.
 * Items whose node or widget cannot be resolved are silently omitted.
 */
export function resolveGroupItems(group: InputGroup): ResolvedGroupItem[] {
  const resolved: ResolvedGroupItem[] = []
  for (const item of group.items) {
    const parsed = parseInputItemKey(item.key)
    if (!parsed) continue
    const { nodeId, widgetName } = parsed
    const [node, widget] = resolveNodeWidget(nodeId, widgetName)
    if (node && widget) {
      resolved.push({
        key: item.key,
        pairId: item.pairId,
        node,
        widget,
        nodeId,
        widgetName
      })
    }
  }
  return resolved
}

/** Group resolved items into rows, pairing items with matching pairId. */
export function groupedByPair(items: ResolvedGroupItem[]): GroupRow[] {
  const rows: GroupRow[] = []
  const paired = new Set<string>()

  for (const item of items) {
    if (paired.has(item.key)) continue

    if (item.pairId) {
      const partner = items.find(
        (other) =>
          other.key !== item.key &&
          other.pairId === item.pairId &&
          !paired.has(other.key)
      )
      if (partner) {
        paired.add(item.key)
        paired.add(partner.key)
        rows.push({ type: 'pair', items: [item, partner] })
        continue
      }
    }

    rows.push({ type: 'single', item })
  }

  return rows
}
