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

type SavedAppRead =
  | { ok: true; json: ComfyWorkflowJSON }
  | { ok: false; detail: string }

const savedApps = new Map<string, ComfyWorkflowJSON>()

export function errorDetail(cause: unknown): string {
  return getErrorMessage(cause) ?? t('g.unknownError')
}

export function findAppWorkflow(path: string): ComfyWorkflow | null {
  return useWorkflowStore().getWorkflowByPath(path)
}

export function isRegisteredNodeType(type: string): boolean {
  return Object.hasOwn(LiteGraph.registered_node_types, type)
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

/** The saved app file (never a draft), cached per path and modification time. */
export async function readSavedApp(
  workflow: ComfyWorkflow
): Promise<SavedAppRead> {
  const key = `${workflow.path}@${workflow.lastModified}`
  const cached = savedApps.get(key)
  if (cached) return { ok: true, json: cached }
  const read = await loadSavedState(workflow)
  if (read.ok) savedApps.set(key, read.json)
  return read
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
