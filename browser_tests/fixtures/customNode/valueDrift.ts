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
  'ComfyUI-KJNodes': {
    SplineEditor: '1'
  },
  'ComfyUI-LTXVideo': {
    LTXVSparseTrackEditor: '1'
  },
  'WhatDreamsCost-ComfyUI': {
    LoadAudioUI: '2,3,5',
    LTXDirector: '3,4,5,7'
  },
  'comfyui-itools': {
    iToolsRegexNode: '0'
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
  'ComfyUI-KJNodes': {
    SplineEditor: '1'
  },
  'ComfyUI-LTXVideo': {
    LTXVSparseTrackEditor: '1'
  },
  'WhatDreamsCost-ComfyUI': {
    LoadAudioUI: '2,3,5',
    LTXDirector: '3,4,5,7'
  },
  'comfyui-itools': {
    iToolsRegexNode: '0'
  }
}

const VHS_ROUNDTRIP_VALUE_KEYS = {
  VHS_LoadAudioUpload: 'choose audio to upload',
  VHS_LoadImages: 'choose folder to upload',
  VHS_LoadVideo: 'choose video to upload',
  VHS_LoadVideoFFmpeg: 'choose video to upload',
  VHS_VAEDecodeBatched: 'per_batch',
  VHS_VAEEncodeBatched: 'per_batch'
}

export const ROUNDTRIP_VALUE_ALLOWED_KEYS_LITEGRAPH = {
  'ComfyUI-VideoHelperSuite': VHS_ROUNDTRIP_VALUE_KEYS
}

export const ROUNDTRIP_VALUE_ALLOWED_KEYS_VUE = {
  'ComfyUI-VideoHelperSuite': VHS_ROUNDTRIP_VALUE_KEYS
}

export type RoundtripInitializationSignal =
  | { property: string; predicate: 'defined' }
  | { property: string; predicate: 'equals'; value: unknown }
  | { predicate: 'widget-value'; value: unknown; widget: string }
  | { predicate: 'widget-count'; value: number }
  | { predicate: 'minimum-widget-count'; value: number }

export const ROUNDTRIP_INITIALIZATION_SIGNALS: Record<
  string,
  Record<string, RoundtripInitializationSignal>
> = {
  'ComfyUI-KJNodes': {
    ImageTransformKJ: {
      predicate: 'widget-value',
      value: '{"fillColor":"#000000"}',
      widget: 'bboxes'
    }
  },
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
  },
  'comfyui-itools': {
    iToolsPaintNode: {
      predicate: 'widget-count',
      value: 33
    }
  }
}

export function initializationSignalsForTypes(
  signals: Record<string, RoundtripInitializationSignal>,
  types: readonly string[]
): Record<string, RoundtripInitializationSignal> {
  const typeSet = new Set(types)
  return Object.fromEntries(
    Object.entries(signals).filter(([type]) => typeSet.has(type))
  )
}

function expectedInitializationValue(
  signal: RoundtripInitializationSignal
): string {
  if (signal.predicate === 'defined') return 'defined'
  if (signal.predicate === 'minimum-widget-count')
    return `>= ${signal.value} widgets`
  if (signal.predicate === 'widget-count') return `${signal.value} widgets`
  if (signal.predicate === 'widget-value')
    return `${signal.widget} = ${JSON.stringify(signal.value)}`
  return JSON.stringify(signal.value)
}

// Each pending entry carries what it wanted and what it saw. The poll that
// consumes this reports only the returned strings on timeout, so a bare node
// name costs a CI round trip to learn the one number that identifies whether
// the pack is slow or the contract is wrong.
export function pendingRoundtripInitializations(
  signals: Record<string, RoundtripInitializationSignal>,
  values: Record<string, unknown>,
  vueNodesEnabled: boolean
): string[] {
  return Object.entries(signals)
    .filter(([node, signal]) => {
      if (signal.predicate === 'defined') return values[node] === undefined
      if (signal.predicate === 'minimum-widget-count')
        return typeof values[node] !== 'number' || values[node] < signal.value
      if (signal.predicate === 'widget-count')
        return !Object.is(values[node], signal.value)
      return !Object.is(values[node], signal.value)
    })
    .map(
      ([node, signal]) =>
        `${node} (${vueNodesEnabled ? 'vue' : 'litegraph'}: expected ${expectedInitializationValue(signal)}, observed ${JSON.stringify(values[node])})`
    )
}

export function pendingRestoredPreviewWidgets(
  requiredByNode: Record<string, string[]>,
  observedByNode: Record<string, string[]>
): string[] {
  return Object.entries(requiredByNode).flatMap(([node, required]) =>
    required.flatMap((widget) =>
      observedByNode[node]?.includes(widget)
        ? []
        : [
            `${node}: expected ${widget} after reload, observed [${(observedByNode[node] ?? []).join(',')}]`
          ]
    )
  )
}

export const CANVAS_PREVIEW_IMAGE_PATH_PATTERN =
  /\.(?:jpe?g|png|webp)(?:\s*\[(?:input|output|temp)\])?\s*$/i

export function isCanvasPreviewImagePath(value: unknown): value is string {
  return (
    typeof value === 'string' && CANVAS_PREVIEW_IMAGE_PATH_PATTERN.test(value)
  )
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
  return expectation.after === after
}

export function rendererLedgerFor<T>(
  vueNodesEnabled: boolean,
  litegraph: T,
  vue: T
): T {
  return vueNodesEnabled ? vue : litegraph
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

export function staleValueDriftKeys(
  allowed: Record<string, string[]>,
  observed: Record<string, string[]>
): string[] {
  return Object.entries(allowed).flatMap(([node, keys]) =>
    keys
      .filter((key) => !observed[node]?.includes(key))
      .map((key) => `${node}.${key}`)
  )
}
