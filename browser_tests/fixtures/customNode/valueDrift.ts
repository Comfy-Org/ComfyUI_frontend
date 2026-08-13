// Exact serialized indices changed by the artifact-proven pack mechanisms.
// Unlisted indices and renderers without matching evidence remain strict.
export const ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH: Record<
  string,
  Record<string, string>
> = {}

export const ROUNDTRIP_VALUE_ALLOWED_INDICES_VUE: Record<
  string,
  Record<string, string>
> = {}

export interface TopologyExpectation {
  before: number
  after: number
  reason: string
}

export interface RoundtripWidgetTopologyExpectation {
  before: number
  after: number | readonly number[]
  reason: string
}

export const ROUNDTRIP_WIDGET_INITIALIZATION_SIGNALS: Record<
  string,
  Record<string, string>
> = {}

export function pendingWidgetInitializations(
  signals: Record<string, string>,
  values: Record<string, unknown>
): string[] {
  return Object.keys(signals).filter((node) => {
    const value = values[node]
    return typeof value !== 'number' || value < 0
  })
}

export const OUTPUT_TOPOLOGY_EXPECTATIONS_LITEGRAPH: Record<
  string,
  Record<string, TopologyExpectation>
> = {}

export const OUTPUT_TOPOLOGY_EXPECTATIONS_VUE: Record<
  string,
  Record<string, TopologyExpectation>
> = {}

export const ROUNDTRIP_WIDGET_TOPOLOGY_EXPECTATIONS_LITEGRAPH: Record<
  string,
  Record<string, RoundtripWidgetTopologyExpectation>
> = {}

export const ROUNDTRIP_WIDGET_TOPOLOGY_EXPECTATIONS_VUE: Record<
  string,
  Record<string, RoundtripWidgetTopologyExpectation>
> = {}

export function matchesTopologyExpectation(
  expectation:
    | TopologyExpectation
    | RoundtripWidgetTopologyExpectation
    | undefined,
  before: number,
  after: number
): boolean {
  if (expectation?.before !== before) return false
  return Array.isArray(expectation.after)
    ? expectation.after.includes(after)
    : expectation.after === after
}

export function rendererLedgerFor<T>(
  vueNodesEnabled: boolean,
  litegraph: T,
  vue: T
): T {
  return vueNodesEnabled ? vue : litegraph
}

export function partitionValueDriftNodes(
  mechanisms: Record<string, unknown>,
  indexedLedgers: Array<Record<string, unknown>>
): { exact: string[]; legacy: string[] } {
  const exact = [
    ...new Set(indexedLedgers.flatMap((ledger) => Object.keys(ledger)))
  ]
  const exactSet = new Set(exact)
  return {
    exact,
    legacy: Object.keys(mechanisms).filter((node) => !exactSet.has(node))
  }
}

export function staleValueDriftIndices(
  allowed: Record<string, number[]>,
  observed: Record<string, number[]>
): string[] {
  return Object.entries(allowed).flatMap(([node, indices]) =>
    indices
      .filter((index) => !observed[node]?.includes(index))
      .map((index) => `${node}[${index}]`)
  )
}
