import { isEqual } from 'es-toolkit/compat'

import type { SerializedProxyWidgetTuple } from '@/core/schemas/promotionSchema'
import type {
  ProxyWidgetErrorQuarantineEntry,
  ProxyWidgetQuarantineReason
} from '@/core/schemas/proxyWidgetQuarantineSchema'
import { parseProxyWidgetErrorQuarantine } from '@/core/schemas/proxyWidgetQuarantineSchema'
import type { SubgraphNode } from '@/lib/litegraph/src/subgraph/SubgraphNode'
import type { TWidgetValue } from '@/lib/litegraph/src/types/widgets'

const QUARANTINE_PROPERTY = 'proxyWidgetErrorQuarantine'
const QUARANTINE_VERSION = 1

interface MakeQuarantineEntryArgs {
  originalEntry: SerializedProxyWidgetTuple
  reason: ProxyWidgetQuarantineReason
  hostValue?: TWidgetValue
}

export function readHostQuarantine(
  hostNode: SubgraphNode
): ProxyWidgetErrorQuarantineEntry[] {
  return parseProxyWidgetErrorQuarantine(
    hostNode.properties[QUARANTINE_PROPERTY]
  )
}

export function makeQuarantineEntry(
  args: MakeQuarantineEntryArgs
): ProxyWidgetErrorQuarantineEntry {
  const entry: ProxyWidgetErrorQuarantineEntry = {
    originalEntry: args.originalEntry,
    reason: args.reason,
    attemptedAtVersion: QUARANTINE_VERSION
  }
  if (args.hostValue !== undefined) {
    entry.hostValue = args.hostValue
  }
  return entry
}

export function appendHostQuarantine(
  hostNode: SubgraphNode,
  entries: readonly ProxyWidgetErrorQuarantineEntry[]
): void {
  if (entries.length === 0) return

  const existing = readHostQuarantine(hostNode)
  const merged = [...existing]
  for (const candidate of entries) {
    const isDuplicate = merged.some((existingEntry) =>
      isEqual(existingEntry.originalEntry, candidate.originalEntry)
    )
    if (!isDuplicate) merged.push(candidate)
  }

  if (merged.length === 0) {
    delete hostNode.properties[QUARANTINE_PROPERTY]
    return
  }
  hostNode.properties[QUARANTINE_PROPERTY] = merged
}

export function clearHostQuarantine(hostNode: SubgraphNode): void {
  delete hostNode.properties[QUARANTINE_PROPERTY]
}
