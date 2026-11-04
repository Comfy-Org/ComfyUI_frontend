import { isWidgetId, parseWidgetId } from '@comfyorg/graph-model/widgetId'
import type {
  ComboInputSpec,
  InputSpec as InputSpecV2
} from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import {
  isBooleanInputSpec,
  isComboInputSpec,
  isFloatInputSpec,
  isIntInputSpec,
  isStringInputSpec
} from '@comfyorg/object-info-parser/schemas/nodeDefSchemaV2'
import { reportError } from '@comfyorg/telemetry/reportError'
import { countBy, uniqBy } from 'es-toolkit'

import {
  isLoad3dNode,
  isLoad3dResultViewerNode
} from '@/extensions/core/load3d/nodeTypes'
import type {
  LinearData,
  LinearInput
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { createGraphResolver } from '@/renderer/extensions/superComfy/apps/appGraphResolver'
import type {
  AppWidgetResolver,
  ResolvedAppOutput,
  ResolvedAppWidget
} from '@/renderer/extensions/superComfy/apps/appWidgetResolver'
import type { AppFailure } from '@/renderer/extensions/superComfy/apps/appSource'
import {
  errorDetail,
  linearDataOf,
  loadAppSource
} from '@/renderer/extensions/superComfy/apps/appSource'
import { withDetachedAppGraph } from '@/renderer/extensions/superComfy/apps/detachedAppGraph'
import type {
  AppContract,
  FileModality,
  Modality,
  WidgetTarget
} from '@/renderer/extensions/superComfy/engine/documentSchema'

type SettingControl =
  | { control: 'select'; options: (string | number)[] }
  | {
      control: 'number'
      integer: boolean
      min?: number
      max?: number
      step?: number
    }
  | { control: 'toggle' }

type AppInputClass =
  | { as: 'port'; modality: FileModality }
  | { as: 'text' }
  | { as: 'setting'; setting: SettingControl }
  | { as: 'unsupported' }

type AppContractOutcome =
  | { ok: true; contract: AppContract }
  | { ok: false; reason: 'noOutputs' }

type AppContractResolution =
  | { ok: true; contract: AppContract; title: string }
  | AppFailure

type AppInputPort = AppContract['inputs'][number]
type AppOutputPort = AppContract['outputs'][number]
type AppSetting = AppContract['settings'][number]

interface ResolvedEntry {
  target: WidgetTarget
  label: string
  widget: ResolvedAppWidget
  kind: Exclude<AppInputClass, { as: 'unsupported' }>
}

const UNSUPPORTED: AppInputClass = { as: 'unsupported' }

const OUTPUT_NODE_MODALITY = new Map<string, Modality>([
  ['SaveImage', 'image'],
  ['PreviewImage', 'image'],
  ['SaveVideo', 'video'],
  ['CreateVideo', 'video'],
  ['SaveAudio', 'audio'],
  ['PreviewAudio', 'audio'],
  ['SaveGLB', '3d'],
  ['PreviewAny', 'text']
])

const SOCKET_MODALITY: readonly (readonly [string, Modality])[] = [
  ['IMAGE', 'image'],
  ['VIDEO', 'video'],
  ['AUDIO', 'audio'],
  ['MESH', '3d'],
  ['GLB', '3d'],
  ['STRING', 'text']
]

function uploadModality(
  nodeType: string,
  spec: ComboInputSpec
): FileModality | null {
  if (spec.image_upload || spec.animated_image_upload) return 'image'
  if (spec.video_upload) return 'video'
  if (spec.audio_upload) return 'audio'
  if (spec.mesh_upload) return '3d'
  if (isLoad3dNode(nodeType) && !isLoad3dResultViewerNode(nodeType)) return '3d'
  return null
}

function classifyCombo(nodeType: string, spec: ComboInputSpec): AppInputClass {
  const modality = uploadModality(nodeType, spec)
  if (modality) return { as: 'port', modality }
  const options = spec.options ?? []
  if (options.length === 0) return UNSUPPORTED
  return { as: 'setting', setting: { control: 'select', options } }
}

export function classifyAppInput(
  nodeType: string,
  spec: InputSpecV2 | undefined
): AppInputClass {
  if (!spec) return UNSUPPORTED
  if (isComboInputSpec(spec)) return classifyCombo(nodeType, spec)
  if (isStringInputSpec(spec)) return { as: 'text' }
  if (isIntInputSpec(spec) || isFloatInputSpec(spec)) {
    return {
      as: 'setting',
      setting: {
        control: 'number',
        integer: isIntInputSpec(spec),
        min: spec.min,
        max: spec.max,
        step: spec.step
      }
    }
  }
  if (isBooleanInputSpec(spec)) {
    return { as: 'setting', setting: { control: 'toggle' } }
  }
  return UNSUPPORTED
}

export function classifyAppOutput(out: ResolvedAppOutput): Modality | null {
  const byNode = OUTPUT_NODE_MODALITY.get(out.nodeType)
  if (byNode) return byNode
  if (isLoad3dResultViewerNode(out.nodeType)) return '3d'
  const bySocket = SOCKET_MODALITY.find(([type]) =>
    out.inputTypes.includes(type)
  )
  return bySocket?.[1] ?? null
}

function targetOf([id, widgetName]: LinearInput): WidgetTarget {
  const nodeId = isWidgetId(id) ? parseWidgetId(id).nodeId : String(id)
  return { nodeId, widgetName }
}

function resolveEntry(
  input: LinearInput,
  resolver: AppWidgetResolver
): ResolvedEntry | null {
  const target = targetOf(input)
  const widget = resolver.widget(target.nodeId, target.widgetName)
  if (!widget || widget.mode !== 'always' || widget.linked) return null
  const kind = classifyAppInput(widget.nodeType, widget.spec)
  if (kind.as === 'unsupported') return null
  return {
    target,
    label: input[2]?.description ?? widget.label,
    widget,
    kind
  }
}

function disambiguateLabels<T extends { label: string }>(
  entries: readonly T[],
  nodeIdOf: (entry: T) => string
): T[] {
  const counts = countBy(entries, (entry) => entry.label)
  return entries.map((entry) =>
    counts[entry.label] > 1
      ? { ...entry, label: `${entry.label} (#${nodeIdOf(entry)})` }
      : entry
  )
}

function isSelectOption(value: unknown): value is string | number {
  return typeof value === 'string' || typeof value === 'number'
}

function toSetting(
  control: SettingControl,
  base: {
    name: string
    label: string
    required: boolean
    target: WidgetTarget
  },
  value: unknown
): AppSetting {
  switch (control.control) {
    case 'number':
      return {
        ...base,
        ...control,
        ...(typeof value === 'number' && { default: value })
      }
    case 'toggle':
      return {
        ...base,
        ...control,
        ...(typeof value === 'boolean' && { default: value })
      }
    case 'select':
      return {
        ...base,
        ...control,
        ...(isSelectOption(value) && { default: value })
      }
  }
}

function toInputPort(entry: ResolvedEntry): AppInputPort | null {
  const { target, label, widget, kind } = entry
  const name = `in:${target.nodeId}:${target.widgetName}`
  if (kind.as === 'port') {
    return {
      name,
      label,
      modality: kind.modality,
      required: true,
      multi: false,
      target
    }
  }
  if (kind.as !== 'text') return null
  return {
    name,
    label,
    modality: 'text',
    required: false,
    multi: false,
    inline: true,
    target,
    ...(typeof widget.value === 'string' && { default: widget.value })
  }
}

function toAppSetting(entry: ResolvedEntry): AppSetting | null {
  const { target, label, widget, kind } = entry
  if (kind.as !== 'setting') return null
  const base = {
    name: `${target.nodeId}:${target.widgetName}`,
    label,
    required: false,
    target
  }
  return toSetting(kind.setting, base, widget.value)
}

function toOutputPort(
  nodeId: string,
  resolver: AppWidgetResolver
): AppOutputPort | null {
  const output = resolver.output(nodeId)
  const modality = output ? classifyAppOutput(output) : null
  if (!output || !modality) return null
  return {
    name: `out:${nodeId}`,
    label: output.label,
    modality,
    required: false,
    multi: false,
    outputNodeId: nodeId
  }
}

function isPresent<T>(value: T | null): value is T {
  return value !== null
}

export function deriveAppContract(
  linearData: LinearData,
  resolver: AppWidgetResolver,
  version: number
): AppContractOutcome {
  const inputs = uniqBy(linearData.inputs, (input) => {
    const { nodeId, widgetName } = targetOf(input)
    return JSON.stringify([nodeId, widgetName])
  })
  const resolved = inputs.map((input) => resolveEntry(input, resolver))
  const entries = disambiguateLabels(
    resolved.filter(isPresent),
    (entry) => entry.target.nodeId
  )
  const outputIds = linearData.outputs.map(String)
  const outputs = disambiguateLabels(
    outputIds.map((id) => toOutputPort(id, resolver)).filter(isPresent),
    (port) => port.outputNodeId
  )
  if (outputs.length === 0) return { ok: false, reason: 'noOutputs' }
  return {
    ok: true,
    contract: {
      version,
      inputs: entries.map(toInputPort).filter(isPresent),
      outputs,
      settings: entries.map(toAppSetting).filter(isPresent),
      dropped:
        inputs.length - entries.length + outputIds.length - outputs.length
    }
  }
}

const resolutions = new Map<string, AppContractResolution>()

export async function resolveAppContract(
  path: string
): Promise<AppContractResolution> {
  const source = await loadAppSource(path)
  if (!source.ok) return source
  const { workflow, json } = source
  const cacheKey = `${path}@${workflow.lastModified}`
  const cached = resolutions.get(cacheKey)
  if (cached) return cached
  const derived = await withDetachedAppGraph(json, (graph) =>
    deriveAppContract(
      linearDataOf(json),
      createGraphResolver(graph),
      workflow.lastModified
    )
  )
  if (!derived.ok) {
    reportError(derived.cause, {
      errorType: 'error_preparing_supercomfy_app',
      surface: 'graph'
    })
    return {
      ok: false,
      reason: 'prepareFailed',
      detail: errorDetail(derived.cause)
    }
  }
  if (!derived.value.ok) return { ok: false, reason: 'noOutputs' }
  const resolution: AppContractResolution = {
    ok: true,
    contract: derived.value.contract,
    title: workflow.filename
  }
  resolutions.set(cacheKey, resolution)
  return resolution
}
