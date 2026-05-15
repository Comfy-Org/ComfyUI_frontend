import type { LegacyProxyEntrySource } from '@/core/graph/subgraph/promotedWidgetTypes'
import { resolveConcretePromotedWidget } from '@/core/graph/subgraph/resolveConcretePromotedWidget'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'

const LEGACY_PROXY_WIDGET_PREFIX_PATTERN = /^\s*(\d+)\s*:\s*(.+)$/

function canResolve(
  hostNode: SubgraphNode,
  sourceNodeId: string,
  widgetName: string
): boolean {
  return (
    resolveConcretePromotedWidget(hostNode, sourceNodeId, widgetName).status ===
    'resolved'
  )
}

interface StrippedPrefix {
  sourceWidgetName: string
  /** Deepest legacy `n: ` prefix removed from the original widget name. */
  deepestPrefixId?: string
}

function stripLegacyPrefixes(sourceWidgetName: string): StrippedPrefix {
  let remaining = sourceWidgetName
  let deepestPrefixId: string | undefined
  while (true) {
    const match = LEGACY_PROXY_WIDGET_PREFIX_PATTERN.exec(remaining)
    if (!match) return { sourceWidgetName: remaining, deepestPrefixId }
    deepestPrefixId = match[1]
    remaining = match[2]
  }
}

/**
 * Normalize a legacy `proxyWidgets` entry.
 *
 * Under ADR 0009 each `SubgraphNode` is opaque, so the canonical state never
 * resolves through deep nested identities. This helper still recognizes the
 * legacy `"<id>: <name>"` prefix encoding and surfaces the deepest prefix as
 * `disambiguatingSourceNodeId` so migration tooling can preserve it as
 * lookup metadata. The bare entry is returned unchanged when it already
 * resolves at the immediate level.
 */
export function normalizeLegacyProxyWidgetEntry(
  hostNode: SubgraphNode,
  sourceNodeId: string,
  sourceWidgetName: string,
  disambiguatingSourceNodeId?: string
): LegacyProxyEntrySource {
  if (canResolve(hostNode, sourceNodeId, sourceWidgetName)) {
    return {
      sourceNodeId,
      sourceWidgetName,
      ...(disambiguatingSourceNodeId && { disambiguatingSourceNodeId })
    }
  }

  const stripped = stripLegacyPrefixes(sourceWidgetName)
  const patchDisambiguatingSourceNodeId =
    stripped.deepestPrefixId ?? disambiguatingSourceNodeId

  return {
    sourceNodeId,
    sourceWidgetName: stripped.sourceWidgetName,
    ...(patchDisambiguatingSourceNodeId && {
      disambiguatingSourceNodeId: patchDisambiguatingSourceNodeId
    })
  }
}
