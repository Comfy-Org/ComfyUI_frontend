import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import { resolveConcretePromotedWidget } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'

const LEGACY_PROXY_WIDGET_PREFIX_PATTERN = /^\s*(\d+)\s*:\s*(.+)$/

type PromotedWidgetPatch = Omit<PromotedWidgetSource, 'sourceNodeId'>

function resolveCandidate(
  hostNode: SubgraphNode,
  sourceNodeId: string,
  widgetName: string,
  disambiguator?: string
): PromotedWidgetPatch | undefined {
  const result = resolveConcretePromotedWidget(
    hostNode,
    sourceNodeId,
    widgetName,
    disambiguator
  )
  if (result.status !== 'resolved') return undefined

  const sourceNode = hostNode.subgraph.getNodeById(sourceNodeId)
  const inferredDisambiguator =
    disambiguator ??
    (sourceNode?.isSubgraphNode() ? String(result.resolved.node.id) : undefined)

  return {
    sourceWidgetName: widgetName,
    ...(inferredDisambiguator && {
      disambiguatingSourceNodeId: inferredDisambiguator
    })
  }
}

function resolveLegacyPrefixedEntry(
  hostNode: SubgraphNode,
  sourceNodeId: string,
  sourceWidgetName: string,
  disambiguatingSourceNodeId?: string
): PromotedWidgetPatch | undefined {
  let remaining = sourceWidgetName

  while (true) {
    const match = LEGACY_PROXY_WIDGET_PREFIX_PATTERN.exec(remaining)
    if (!match) return undefined

    const [, legacySourceNodeId, unprefixed] = match
    remaining = unprefixed

    const disambiguators = [
      legacySourceNodeId,
      ...(disambiguatingSourceNodeId ? [disambiguatingSourceNodeId] : []),
      undefined
    ]

    for (const disambiguator of disambiguators) {
      const resolved = resolveCandidate(
        hostNode,
        sourceNodeId,
        remaining,
        disambiguator
      )
      if (resolved) return resolved
    }
  }
}

export function normalizeLegacyProxyWidgetEntry(
  hostNode: SubgraphNode,
  sourceNodeId: string,
  sourceWidgetName: string,
  disambiguatingSourceNodeId?: string
): PromotedWidgetSource {
  const exactMatch = resolveCandidate(
    hostNode,
    sourceNodeId,
    sourceWidgetName,
    disambiguatingSourceNodeId
  )
  if (exactMatch) {
    return {
      sourceNodeId,
      sourceWidgetName: exactMatch.sourceWidgetName,
      ...(exactMatch.disambiguatingSourceNodeId && {
        disambiguatingSourceNodeId: exactMatch.disambiguatingSourceNodeId
      })
    }
  }

  const patch = resolveLegacyPrefixedEntry(
    hostNode,
    sourceNodeId,
    sourceWidgetName,
    disambiguatingSourceNodeId
  )

  const normalizedDisambiguatingSourceNodeId =
    patch?.disambiguatingSourceNodeId ?? disambiguatingSourceNodeId

  return {
    sourceNodeId,
    sourceWidgetName: patch?.sourceWidgetName ?? sourceWidgetName,
    ...(normalizedDisambiguatingSourceNodeId && {
      disambiguatingSourceNodeId: normalizedDisambiguatingSourceNodeId
    })
  }
}
