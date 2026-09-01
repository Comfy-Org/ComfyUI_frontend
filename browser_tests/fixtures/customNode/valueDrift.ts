import type { RawNodeDef } from '@e2e/fixtures/customNode/typePairing'

// Exact serialized indices changed by the artifact-proven pack mechanisms.
// Unlisted indices and renderers without matching evidence remain strict.
export const ROUNDTRIP_VALUE_ALLOWED_INDICES_LITEGRAPH: Record<
  string,
  Record<string, string>
> = {
  'ComfyUI-LTXVideo': {
    LTXVSparseTrackEditor: '1'
  },
  'WhatDreamsCost-ComfyUI': {
    LTXDirector: '3,4,5,7'
  },
  'comfyui-sam3': {
    SAM3VideoSegmentation: '1,2'
  }
}

export const ROUNDTRIP_VALUE_ALLOWED_INDICES_VUE: Record<
  string,
  Record<string, string>
> = {
  'ComfyUI-LTXVideo': {
    LTXVSparseTrackEditor: '1'
  },
  'WhatDreamsCost-ComfyUI': {
    LTXDirector: '3,4,5,7'
  },
  'comfyui-sam3': {
    SAM3VideoSegmentation: '1,2'
  }
}

const VHS_ROUNDTRIP_VALUE_KEYS_LITEGRAPH = {
  VHS_VAEDecodeBatched: 'per_batch',
  VHS_VAEEncodeBatched: 'per_batch'
}

export const ROUNDTRIP_VALUE_ALLOWED_KEYS_LITEGRAPH = {
  'ComfyUI-VideoHelperSuite': VHS_ROUNDTRIP_VALUE_KEYS_LITEGRAPH
}

export const ROUNDTRIP_VALUE_ALLOWED_KEYS_VUE = {
  'ComfyUI-VideoHelperSuite': {
    VHS_VAEDecodeBatched: 'per_batch',
    VHS_VAEEncodeBatched: 'per_batch'
  }
}

export type RoundtripInitializationSignal =
  | { property: string; predicate: 'defined' }
  | { property: string; predicate: 'equals'; value: unknown }
  | { inputs: string[]; predicate: 'inputs-absent' }
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
      inputs: ['positive_boxes', 'negative_boxes'],
      predicate: 'inputs-absent'
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
  if (signal.predicate === 'inputs-absent')
    return `inputs absent [${signal.inputs.join(',')}]`
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
  values: Record<string, unknown> | undefined,
  vueNodesEnabled: boolean
): string[] {
  return Object.entries(signals)
    .filter(([node, signal]) => {
      const observed = values?.[node]
      if (signal.predicate === 'defined') return observed === undefined
      if (signal.predicate === 'inputs-absent') {
        return (
          !Array.isArray(observed) ||
          signal.inputs.some((input) => observed.includes(input))
        )
      }
      if (signal.predicate === 'minimum-widget-count')
        return typeof observed !== 'number' || observed < signal.value
      if (signal.predicate === 'widget-count')
        return !Object.is(observed, signal.value)
      return !Object.is(observed, signal.value)
    })
    .map(
      ([node, signal]) =>
        `${node} (${vueNodesEnabled ? 'vue' : 'litegraph'}: expected ${expectedInitializationValue(signal)}, observed ${JSON.stringify(values?.[node])})`
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

export const ROUNDTRIP_NODE_LOSS_EXPECTATIONS_LITEGRAPH: Record<
  string,
  Record<string, RoundtripNodeLossExpectation>
> = {}

export const ROUNDTRIP_NODE_LOSS_EXPECTATIONS_VUE: Record<
  string,
  Record<string, RoundtripNodeLossExpectation>
> = {}

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

export interface NamedWidgetValueDrift {
  name: string
  before: unknown
  after: unknown
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function declaredInputNamesForTypes(
  defs: Record<string, RawNodeDef>,
  types: readonly string[]
): Record<string, string[]> {
  return Object.fromEntries(
    types.map((type) => {
      const def = defs[type]
      if (!def) throw new Error(`${type} has no backend node definition`)
      return [
        type,
        [
          ...Object.keys(def.input?.required ?? {}),
          ...Object.keys(def.input?.optional ?? {})
        ]
      ]
    })
  )
}

export function namedWidgetValueDrifts(
  before: unknown,
  after: unknown,
  names?: readonly string[]
): NamedWidgetValueDrift[] | null {
  if (!isRecord(before) || !isRecord(after)) return null

  const comparedNames = names
    ? names.filter((name) => name in before)
    : Object.keys(before).filter((name) => name in after)
  if (comparedNames.length === 0) return names ? [] : null

  return comparedNames.flatMap((name) => {
    return name in after &&
      JSON.stringify(before[name]) === JSON.stringify(after[name])
      ? []
      : [{ name, before: before[name], after: after[name] }]
  })
}
