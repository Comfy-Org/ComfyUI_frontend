import type { PromotedWidgetSource } from '@/core/graph/subgraph/promotedWidgetTypes'
import { resolveConcretePromotedWidget } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'

const LEGACY_PROXY_WIDGET_PREFIX_PATTERN = /^\s*(\d+)\s*:\s*(.+)$/

type PromotedWidgetPatch = Omit<PromotedWidgetSource, 'sourceNodeId'>

function canResolve(
  hostNode: SubgraphNode,
  sourceNodeId: string,
  widgetName: string,
  disambiguator?: string
): boolean {
  return (
    resolveConcretePromotedWidget(
      hostNode,
      sourceNodeId,
      widgetName,
      disambiguator
    ).status === 'resolved'
  )
}

function tryResolveCandidate(
  hostNode: SubgraphNode,
  sourceNodeId: string,
  widgetName: string,
  disambiguator?: string
): PromotedWidgetPatch | undefined {
  if (!canResolve(hostNode, sourceNodeId, widgetName, disambiguator))
    return undefined

  return {
    sourceWidgetName: widgetName,
    ...(disambiguator && { disambiguatingSourceNodeId: disambiguator })
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
      const resolved = tryResolveCandidate(
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
  if (
    canResolve(
      hostNode,
      sourceNodeId,
      sourceWidgetName,
      disambiguatingSourceNodeId
    )
  ) {
    return {
      sourceNodeId,
      sourceWidgetName,
      ...(disambiguatingSourceNodeId && { disambiguatingSourceNodeId })
    }
  }

  const patch = resolveLegacyPrefixedEntry(
    hostNode,
    sourceNodeId,
    sourceWidgetName,
    disambiguatingSourceNodeId
  )

  const patchDisambiguatingSourceNodeId =
    patch?.disambiguatingSourceNodeId ?? disambiguatingSourceNodeId

  return {
    sourceNodeId,
    sourceWidgetName: patch?.sourceWidgetName ?? sourceWidgetName,
    ...(patchDisambiguatingSourceNodeId && {
      disambiguatingSourceNodeId: patchDisambiguatingSourceNodeId
    })
  }
}
