import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import { resolveConcretePromotedWidget } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import type { Subgraph } from '@/lib/litegraph/src/subgraph/Subgraph'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import { makePromotionEntryKey } from '@/stores/promotionStore'

export type LinkedPromotionEntry = PromotedWidgetSource & {
  inputName: string
  inputKey: string
  slotName: string
}

export interface ResolvedPromotionEntries {
  linkedPromotionEntries: PromotedWidgetSource[]
  fallbackStoredEntries: PromotedWidgetSource[]
  shouldPersistLinkedOnly: boolean
}

export function resolvePromotionEntries(
  storeEntries: PromotedWidgetSource[],
  linkedEntries: LinkedPromotionEntry[],
  connectedEntryKeys: Set<string>,
  inputCount: number,
  subgraph: Subgraph,
  subgraphNode: SubgraphNode
): ResolvedPromotionEntries {
  const linkedPromotionEntries = toPromotionEntries(linkedEntries)

  const excludedEntryKeys = new Set(
    linkedPromotionEntries.map((e) => makePromotionEntryKey(e))
  )
  for (const key of connectedEntryKeys) {
    excludedEntryKeys.add(key)
  }

  const prePruneFallback = storeEntries.filter(
    (e) => !excludedEntryKeys.has(makePromotionEntryKey(e))
  )

  const fallbackStoredEntries = pruneStaleFallbackAliases(
    prePruneFallback,
    linkedPromotionEntries,
    subgraph,
    subgraphNode
  )

  const persistLinkedOnly = shouldPersistLinkedOnly(
    linkedEntries,
    fallbackStoredEntries,
    inputCount,
    subgraph
  )

  return {
    linkedPromotionEntries,
    fallbackStoredEntries,
    shouldPersistLinkedOnly: persistLinkedOnly
  }
}

function toPromotionEntries(
  linkedEntries: LinkedPromotionEntry[]
): PromotedWidgetSource[] {
  return linkedEntries.map(
    ({ sourceNodeId, sourceWidgetName, disambiguatingSourceNodeId }) => ({
      sourceNodeId,
      sourceWidgetName,
      ...(disambiguatingSourceNodeId && { disambiguatingSourceNodeId })
    })
  )
}

function shouldPersistLinkedOnly(
  linkedEntries: LinkedPromotionEntry[],
  fallbackStoredEntries: PromotedWidgetSource[],
  inputCount: number,
  subgraph: Subgraph
): boolean {
  if (!(inputCount > 0 && linkedEntries.length === inputCount)) return false

  const linkedEntryKeys = new Set(
    linkedEntries.map((e) =>
      makePromotionEntryKey({
        sourceNodeId: e.sourceNodeId,
        sourceWidgetName: e.sourceWidgetName
      })
    )
  )

  const linkedWidgetNames = new Set(
    linkedEntries.map((e) => e.sourceWidgetName)
  )

  const hasFallbackToKeep = fallbackStoredEntries.some((entry) => {
    const sourceNode = subgraph.getNodeById(entry.sourceNodeId)
    if (!sourceNode) return linkedWidgetNames.has(entry.sourceWidgetName)

    const hasSourceWidget =
      sourceNode.widgets?.some(
        (widget) => widget.name === entry.sourceWidgetName
      ) === true
    if (hasSourceWidget) return true

    return linkedEntryKeys.has(
      makePromotionEntryKey({
        sourceNodeId: entry.sourceNodeId,
        sourceWidgetName: entry.sourceWidgetName
      })
    )
  })

  return !hasFallbackToKeep
}

function pruneStaleFallbackAliases(
  fallbackEntries: PromotedWidgetSource[],
  linkedPromotionEntries: PromotedWidgetSource[],
  subgraph: Subgraph,
  subgraphNode: SubgraphNode
): PromotedWidgetSource[] {
  if (fallbackEntries.length === 0 || linkedPromotionEntries.length === 0)
    return fallbackEntries

  const linkedConcreteKeys = new Set(
    linkedPromotionEntries
      .map((e) => resolveConcreteEntryKey(e, subgraphNode))
      .filter((key): key is string => key !== undefined)
  )
  if (linkedConcreteKeys.size === 0) return fallbackEntries

  const pruned: PromotedWidgetSource[] = []
  for (const entry of fallbackEntries) {
    if (!subgraph.getNodeById(entry.sourceNodeId)) continue

    const concreteKey = resolveConcreteEntryKey(entry, subgraphNode)
    if (concreteKey && linkedConcreteKeys.has(concreteKey)) continue

    pruned.push(entry)
  }

  return pruned
}

function resolveConcreteEntryKey(
  entry: PromotedWidgetSource,
  subgraphNode: SubgraphNode
): string | undefined {
  const result = resolveConcretePromotedWidget(
    subgraphNode,
    entry.sourceNodeId,
    entry.sourceWidgetName,
    entry.disambiguatingSourceNodeId
  )
  if (result.status !== 'resolved') return undefined

  return makePromotionEntryKey({
    sourceNodeId: String(result.resolved.node.id),
    sourceWidgetName: result.resolved.widget.name
  })
}

export function buildLinkedReconcileEntries(
  linkedEntries: LinkedPromotionEntry[]
): Array<{
  sourceNodeId: string
  sourceWidgetName: string
  viewKey: string
  disambiguatingSourceNodeId?: string
  slotName: string
}> {
  return linkedEntries.map(
    ({
      inputKey,
      inputName,
      slotName,
      sourceNodeId,
      sourceWidgetName,
      disambiguatingSourceNodeId
    }) => ({
      sourceNodeId,
      sourceWidgetName,
      slotName,
      disambiguatingSourceNodeId,
      viewKey: makePromotionViewKey(
        inputKey,
        sourceNodeId,
        sourceWidgetName,
        inputName,
        disambiguatingSourceNodeId
      )
    })
  )
}

export function buildDisplayNameByViewKey(
  linkedEntries: LinkedPromotionEntry[]
): Map<string, string> {
  return new Map(
    linkedEntries.map((entry) => [
      makePromotionViewKey(
        entry.inputKey,
        entry.sourceNodeId,
        entry.sourceWidgetName,
        entry.inputName,
        entry.disambiguatingSourceNodeId
      ),
      entry.inputName
    ])
  )
}

export function makePromotionViewKey(
  inputKey: string,
  sourceNodeId: string,
  sourceWidgetName: string,
  inputName = '',
  disambiguatingSourceNodeId?: string
): string {
  return disambiguatingSourceNodeId
    ? JSON.stringify([
        inputKey,
        sourceNodeId,
        sourceWidgetName,
        inputName,
        disambiguatingSourceNodeId
      ])
    : JSON.stringify([inputKey, sourceNodeId, sourceWidgetName, inputName])
}
