// Exact serialized indices changed by the artifact-proven pack mechanisms.
// Unlisted indices and renderers without matching evidence remain strict.
export const ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH: Record<
  string,
  Record<string, string>
> = {
  'ComfyUI_Fill-Nodes': {
    FL_ColorPicker: '3,4,5,6',
    FL_ReplaceColor: '5,6,7,8,9,10,11,12'
  },
  'WhatDreamsCost-ComfyUI': {
    LoadAudioUI: '5',
    LTXDirector: '3,4,5,7'
  }
}

export const ROUNDTRIP_VALUE_ALLOWED_INDICES_VUE: Record<
  string,
  Record<string, string>
> = {
  'ComfyUI_Fill-Nodes': {
    FL_ColorPicker: '3,4,5,6',
    FL_ReplaceColor: '5,6,7,8,9,10,11,12'
  },
  'WhatDreamsCost-ComfyUI': {
    LoadAudioUI: '5',
    LTXDirector: '3,4,5,7'
  },
  'comfyui-itools': {
    iToolsRegexNode: '0'
  }
}

export type RoundtripInitializationSignal =
  | { property: string; predicate: 'defined' }
  | { property: string; predicate: 'equals'; value: unknown }

export const ROUNDTRIP_INITIALIZATION_SIGNALS: Record<
  string,
  Record<string, RoundtripInitializationSignal>
> = {
  'WhatDreamsCost-ComfyUI': {
    LoadAudioUI: {
      property: '_initializing',
      predicate: 'equals',
      value: false
    }
  },
  'comfyui-sam3': {
    SAM3VideoSegmentation: {
      property: '_hiddenInputs',
      predicate: 'defined'
    }
  }
}

export function pendingRoundtripInitializations(
  signals: Record<string, RoundtripInitializationSignal>,
  values: Record<string, unknown>
): string[] {
  return Object.entries(signals)
    .filter(([node, signal]) =>
      signal.predicate === 'defined'
        ? values[node] === undefined
        : !Object.is(values[node], signal.value)
    )
    .map(([node]) => node)
}

export interface RoundtripNodeLossExpectation {
  reason: string
  restore: string
}

const FL_TIMELINE_NODE_LOSS: RoundtripNodeLossExpectation = {
  reason:
    'the pack replaces node.serialize with a timeline-data serializer, so graph reload drops the node',
  restore:
    'fix FL_TimeLine to preserve LiteGraph node serialization, then remove this entry when both renderer passes retain it'
}

export const ROUNDTRIP_NODE_LOSS_EXPECTATIONS_LITEGRAPH: Record<
  string,
  Record<string, RoundtripNodeLossExpectation>
> = {
  'ComfyUI_Fill-Nodes': { FL_TimeLine: FL_TIMELINE_NODE_LOSS }
}

export const ROUNDTRIP_NODE_LOSS_EXPECTATIONS_VUE: Record<
  string,
  Record<string, RoundtripNodeLossExpectation>
> = {
  'ComfyUI_Fill-Nodes': { FL_TimeLine: FL_TIMELINE_NODE_LOSS }
}

export interface TopologyExpectation {
  before: number
  after: number
  reason: string
}

export const OUTPUT_TOPOLOGY_EXPECTATIONS_LITEGRAPH: Record<
  string,
  Record<string, TopologyExpectation>
> = {
  'ComfyUI_Fill-Nodes': {
    FL_VideoBatchSplitter: {
      before: 20,
      after: 4,
      reason: 'pack JS trims the declared outputs to output_count on creation'
    }
  },
  'WhatDreamsCost-ComfyUI': {
    MultiImageLoader: {
      before: 51,
      after: 1,
      reason: 'pack JS trims unloaded image outputs on creation'
    }
  }
}

export const OUTPUT_TOPOLOGY_EXPECTATIONS_VUE: Record<
  string,
  Record<string, TopologyExpectation>
> = {
  'ComfyUI_Fill-Nodes': {
    FL_VideoBatchSplitter: {
      before: 20,
      after: 4,
      reason: 'pack JS trims the declared outputs to output_count on creation'
    }
  },
  'WhatDreamsCost-ComfyUI': {
    MultiImageLoader: {
      before: 51,
      after: 1,
      reason: 'pack JS trims unloaded image outputs on creation'
    }
  }
}

export function matchesTopologyExpectation(
  expectation: TopologyExpectation | undefined,
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
