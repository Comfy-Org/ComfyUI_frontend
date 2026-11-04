import type { ComfyWorkflowJSON } from '@comfyorg/graph-model/workflowSchema'
import { getErrorMessage } from '@comfyorg/shared-frontend-utils/errorUtil'
import { toRaw } from 'vue'

import { t } from '@/i18n'
import { LiteGraph } from '@/lib/litegraph/src/litegraph'
import type {
  ComfyWorkflow,
  LinearData,
  LinearInput
} from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { findMissingNodeTypes } from '@/renderer/extensions/superComfy/apps/detachedAppGraph'

export interface AppFailure {
  ok: false
  reason: 'notFound' | 'noOutputs' | 'missingNodes' | 'prepareFailed'
  detail?: string
}

type SavedAppRead =
  | { ok: true; json: ComfyWorkflowJSON }
  | { ok: false; detail: string }

type AppSource =
  | { ok: true; workflow: ComfyWorkflow; json: ComfyWorkflowJSON }
  | AppFailure

const savedApps = new Map<string, ComfyWorkflowJSON>()

export function errorDetail(cause: unknown): string {
  return getErrorMessage(cause) ?? t('g.unknownError')
}

function findAppWorkflow(path: string): ComfyWorkflow | null {
  return useWorkflowStore().getWorkflowByPath(path)
}

function isRegisteredNodeType(type: string): boolean {
  return Object.hasOwn(LiteGraph.registered_node_types, type)
}

/** The message a node shows when its app cannot be resolved or run. */
export function appFailureMessage({ reason, detail }: AppFailure): string {
  switch (reason) {
    case 'notFound':
      return t('superComfy.app.notFound')
    case 'noOutputs':
      return t('superComfy.app.noOutputs')
    case 'missingNodes':
      return t('superComfy.app.missingNodes', { nodes: detail ?? '' })
    case 'prepareFailed':
      return t('superComfy.app.prepareFailed')
  }
}

async function loadSavedState(workflow: ComfyWorkflow): Promise<SavedAppRead> {
  const wasLoaded = workflow.isLoaded
  try {
    await workflow.load()
  } catch (cause) {
    return { ok: false, detail: errorDetail(cause) }
  }
  const saved = workflow.initialState
  if (!wasLoaded && !useWorkflowStore().isOpen(workflow)) workflow.unload()
  if (!saved) return { ok: false, detail: workflow.path }
  return { ok: true, json: structuredClone(toRaw(saved)) }
}

async function readSavedApp(workflow: ComfyWorkflow): Promise<SavedAppRead> {
  const key = `${workflow.path}@${workflow.lastModified}`
  const cached = savedApps.get(key)
  if (cached) return { ok: true, json: cached }
  const read = await loadSavedState(workflow)
  if (read.ok) savedApps.set(key, read.json)
  return read
}

/** Reads the saved app (never a draft) and checks its node types exist. */
export async function loadAppSource(path: string): Promise<AppSource> {
  const workflow = findAppWorkflow(path)
  if (!workflow) return { ok: false, reason: 'notFound' }
  const saved = await readSavedApp(workflow)
  if (!saved.ok) {
    return { ok: false, reason: 'prepareFailed', detail: saved.detail }
  }
  const missing = findMissingNodeTypes(saved.json, isRegisteredNodeType)
  if (missing.length > 0) {
    return { ok: false, reason: 'missingNodes', detail: missing.join(', ') }
  }
  return { ok: true, workflow, json: saved.json }
}

export function linearDataOf(json: ComfyWorkflowJSON): LinearData {
  const linearData = json.extra?.linearData
  const inputs = (linearData?.inputs ?? []).map(
    ([id, widgetName, config]): LinearInput => [
      id,
      widgetName,
      typeof config?.description === 'string'
        ? { description: config.description }
        : undefined
    ]
  )
  return { inputs, outputs: linearData?.outputs ?? [] }
}
