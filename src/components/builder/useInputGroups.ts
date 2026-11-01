import type { ResolvedSelection } from '@/components/builder/useResolvedSelectedInputs'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { useLinkStore } from '@/stores/linkStore'
import { LGraphEventMode } from '@comfyorg/graph-model/globalEnums'
import { graphScopeOf } from '@comfyorg/graph-model/graphScopeId'
import { t } from '@/i18n'
import type { InputGroup } from '@comfyorg/graph-model/workflowSchema'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'

interface ResolvedGroupItem {
  key: WidgetId
  pairId?: string
}

type GroupRow =
  | { type: 'single'; item: ResolvedGroupItem }
  | { type: 'pair'; items: [ResolvedGroupItem, ResolvedGroupItem] }

type LinkLookup = Pick<
  ReturnType<typeof useLinkStore>,
  'isInputSlotConnected'
>

export function createInputLinkChecker(linkStore: LinkLookup) {
  return (node: LGraphNode, widgetName: string): boolean => {
    const graph = node.graph
    const slot = node.inputs?.findIndex((input) => input.widget?.name === widgetName)
    return (
      !!graph &&
      slot !== undefined &&
      slot >= 0 &&
      linkStore.isInputSlotConnected(graphScopeOf(graph), node.id, slot)
    )
  }
}

export function isRenderableAppInput(
  selection: ResolvedSelection,
  isInputLinked: ReturnType<typeof createInputLinkChecker>
): selection is Extract<ResolvedSelection, { status: 'resolved' }> {
  return (
    selection.status === 'resolved' &&
    selection.node.mode === LGraphEventMode.ALWAYS &&
    !isInputLinked(selection.node, selection.widget.name)
  )
}

export function groupPosition(
  index: number,
  count: number
): 'first' | 'middle' | 'last' | 'only' {
  if (count === 1) return 'only'
  if (index === 0) return 'first'
  if (index === count - 1) return 'last'
  return 'middle'
}

export function autoGroupName(
  group: InputGroup,
  selections: readonly ResolvedSelection[]
): string {
  const selectionsById = new Map(
    selections.map((selection) => [selection.widgetId, selection])
  )
  const labels: string[] = []
  for (const item of group.items) {
    const selection = selectionsById.get(item.key)
    if (!selection) continue
    labels.push(
      selection.status === 'resolved'
        ? (selection.widget.label ?? selection.displayName)
        : selection.displayName
    )
  }
  return labels.join(', ') || t('linearMode.groups.untitled')
}

export function resolveGroupItems(
  group: InputGroup,
  selections: readonly ResolvedSelection[]
): ResolvedGroupItem[] {
  const selectedIds = new Set(
    selections.flatMap((selection) =>
      selection.status === 'resolved' ? [selection.widgetId] : []
    )
  )
  return group.items.filter(({ key }) => selectedIds.has(key))
}

export function groupedByPair(items: ResolvedGroupItem[]): GroupRow[] {
  const rows: GroupRow[] = []
  const paired = new Set<WidgetId>()
  const pairCandidates = new Map<string, ResolvedGroupItem[]>()

  for (const item of items) {
    if (!item.pairId) continue
    const candidates = pairCandidates.get(item.pairId) ?? []
    candidates.push(item)
    pairCandidates.set(item.pairId, candidates)
  }

  for (const item of items) {
    if (paired.has(item.key)) continue

    if (item.pairId) {
      const partner = pairCandidates
        .get(item.pairId)
        ?.find((other) => other.key !== item.key && !paired.has(other.key))
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
