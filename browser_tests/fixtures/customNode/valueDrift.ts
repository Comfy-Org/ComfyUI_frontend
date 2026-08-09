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
  'ComfyUI-LTXVideo': {
    LTXVSparseTrackEditor: '0,1'
  },
  'WhatDreamsCost-ComfyUI': {
    LTXDirector: '3,4,5,7',
    LoadAudioUI: '5'
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
  'ComfyUI-LTXVideo': {
    LTXVSparseTrackEditor: '0,1'
  },
  'WhatDreamsCost-ComfyUI': {
    LTXDirector: '3,4,5,7',
    LoadAudioUI: '5'
  },
  'comfyui-itools': {
    iToolsRegexNode: '0'
  },
  radiance: {
    RadianceSamplerPro: '1,4,5,8,10,11,12,40'
  }
}

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

export const OUTPUT_TOPOLOGY_EXPECTATIONS_LITEGRAPH: Record<
  string,
  Record<string, TopologyExpectation>
> = {
  'ComfyUI_Fill-Nodes': {
    FL_VideoBatchSplitter: {
      before: 20,
      after: 4,
      reason:
        'pack JS exposes output_count outputs on the instance; the default is 4 of 20 declared outputs'
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
      reason:
        'pack JS exposes output_count outputs on the instance; the default is 4 of 20 declared outputs'
    }
  }
}

export const ROUNDTRIP_WIDGET_TOPOLOGY_EXPECTATIONS_LITEGRAPH: Record<
  string,
  Record<string, RoundtripWidgetTopologyExpectation>
> = {
  'WhatDreamsCost-ComfyUI': {
    LTXKeyframer: {
      before: 102,
      after: [2, 5] as const,
      reason:
        'pack JS restores either its two static widgets or one image header/frame/strength set according to restored num_images state'
    }
  }
}

export const ROUNDTRIP_WIDGET_TOPOLOGY_EXPECTATIONS_VUE: Record<
  string,
  Record<string, RoundtripWidgetTopologyExpectation>
> = {
  'WhatDreamsCost-ComfyUI': {
    LTXKeyframer: {
      before: 102,
      after: [2, 5] as const,
      reason:
        'pack JS restores either its two static widgets or one image header/frame/strength set according to restored num_images state'
    },
    LTXSequencer: {
      before: 154,
      after: 8,
      reason:
        'pack restores one separator, three static widgets, and one four-widget image track'
    }
  }
}

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
