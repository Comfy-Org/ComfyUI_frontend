import type { ComfyApiWorkflow } from '@comfyorg/graph-model/workflowSchema'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import { mapValues } from 'es-toolkit'

import { applyPromotedWidgetControl } from '@/core/graph/subgraph/promotedWidgetControl'
import type { LGraph } from '@/lib/litegraph/src/litegraph'
import type {
  AppContract,
  AppNode,
  MediaItem,
  SettingValue,
  WidgetTarget
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import type { PlannedRun } from '@/renderer/extensions/superComfy/engine/types'
import { toLoaderValue } from '@/renderer/extensions/superComfy/media/superMedia'
import { collectAllNodes } from '@/utils/graphTraversalUtil'
import {
  executeWidgetsCallback,
  resolveNodeWidget
} from '@/utils/litegraphUtil'

type ApiNode = ComfyApiWorkflow[string]
type AppInputPort = AppContract['inputs'][number]

interface PendingBinding {
  target: WidgetTarget
  value: SettingValue | undefined
  coerce: boolean
}

interface ReadyBinding {
  widget: IBaseWidget
  value: SettingValue
}

const RUN_FILENAME_PREFIX = 'supercomfy/run'

const PREVIEW_TO_SAVE = new Map([
  ['PreviewImage', 'SaveImage'],
  ['PreviewAudio', 'SaveAudio']
])

function rewriteOutputNode(node: ApiNode, runTag: string): ApiNode {
  const saveType = PREVIEW_TO_SAVE.get(node.class_type)
  const saved = saveType
    ? {
        ...node,
        class_type: saveType,
        inputs: { ...node.inputs, filename_prefix: RUN_FILENAME_PREFIX }
      }
    : node
  const prefix: unknown = saved.inputs.filename_prefix
  if (typeof prefix !== 'string') return saved
  return {
    ...saved,
    inputs: { ...saved.inputs, filename_prefix: `${prefix}_${runTag}` }
  }
}

/** Turns bound Preview nodes into Save nodes and tags every bound `filename_prefix` with `runTag`. */
export function rewriteBoundOutputs(
  output: ComfyApiWorkflow,
  outputIds: readonly string[],
  runTag: string
): ComfyApiWorkflow {
  const bound = new Set(outputIds)
  return mapValues(output, (node, id) =>
    bound.has(String(id)) ? rewriteOutputNode(node, runTag) : node
  )
}

function portValue(
  port: AppInputPort,
  items: readonly MediaItem[]
): string | undefined {
  const item = items.at(0)
  if (port.modality === 'text') return item?.kind === 'text' ? item.text : ''
  return item?.kind === 'file' ? toLoaderValue(item) : undefined
}

function coerceToWidget(
  value: SettingValue,
  current: unknown
): SettingValue | undefined {
  if (typeof current === 'number') {
    const number = typeof value === 'number' ? value : Number(value)
    return Number.isFinite(number) ? number : undefined
  }
  if (typeof current === 'boolean') {
    return typeof value === 'boolean' ? value : value === 'true'
  }
  if (typeof current === 'string') return String(value)
  return value
}

function pendingBindings(
  contract: AppContract,
  node: AppNode,
  run: PlannedRun
): PendingBinding[] {
  const ports = contract.inputs.map((port) => ({
    target: port.target,
    value: portValue(port, run.inputs[port.name] ?? []),
    coerce: false
  }))
  const settings = contract.settings
    .filter((setting) => Object.hasOwn(node.values, setting.name))
    .map((setting) => ({
      target: setting.target,
      value: node.values[setting.name],
      coerce: true
    }))
  return [...ports, ...settings]
}

function readyBinding(
  graph: LGraph,
  binding: PendingBinding
): ReadyBinding | null {
  const [, widget] = resolveNodeWidget(
    binding.target.nodeId,
    binding.target.widgetName,
    graph
  )
  if (!widget || binding.value === undefined) return null
  const value = binding.coerce
    ? coerceToWidget(binding.value, widget.value)
    : binding.value
  return value === undefined ? null : { widget, value }
}

/** Writes one run's inputs and changed settings into the app widgets; false, writing nothing, when a target is missing. */
export function bindRunValues(
  graph: LGraph,
  node: AppNode,
  run: PlannedRun
): boolean {
  if (!node.contract) return false
  const ready = pendingBindings(node.contract, node, run).map((binding) =>
    readyBinding(graph, binding)
  )
  if (!ready.every((binding): binding is ReadyBinding => binding !== null)) {
    return false
  }
  for (const { widget, value } of ready) widget.value = value
  return true
}

export function runQueueHooks(
  graph: LGraph,
  phase: 'beforeQueued' | 'afterQueued'
): void {
  const nodes = collectAllNodes(graph)
  executeWidgetsCallback(nodes, phase, { isPartialExecution: false })
  for (const node of nodes) applyPromotedWidgetControl(node, phase)
}
