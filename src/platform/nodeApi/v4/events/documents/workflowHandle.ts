import { isPlainObject } from 'es-toolkit'

import { validateComfyWorkflow } from '@comfyorg/graph-model/workflowSchema'

import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { useApp } from '@/scripts/appInstance'
import { applyTextReplacements } from '@/utils/searchAndReplace'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { savedCopier } from '@/platform/nodeApi/shared/savedCopy'
import type {
  DocumentHandle,
  WorkflowData,
  WorkflowHandle
} from '@/platform/nodeApi/v4/types'

import type { WorkflowExtra } from './workflowExtra'
import type { WorkflowImporters } from './workflowImporters'

export function createWorkflowHandle(
  current: () => DocumentHandle | undefined,
  importers: WorkflowImporters,
  getGraph: () => LGraph | null,
  extra: WorkflowExtra
): WorkflowHandle {
  const copyOfSaved = savedCopier()
  return Object.freeze({
    current,
    documentId: () => current()?.id,
    snapshot() {
      const root = getGraph()?.rootGraph
      if (!root) return undefined
      const saved: unknown = copyOfSaved('workflow.snapshot', root.serialize())
      return isPlainObject(saved) ? saved : undefined
    },
    open(data: WorkflowData) {
      if (!isPlainObject(data)) {
        throw invalidArgument('workflow.open', 'ComfyUI workflow data', data)
      }
      return openWorkflow(data)
    },
    applyTextReplacements(value: string) {
      if (typeof value !== 'string') {
        throw invalidArgument(
          'workflow.applyTextReplacements',
          'a string',
          value
        )
      }
      const root = getGraph()?.rootGraph
      return root && applyTextReplacements(root, value)
    },
    registerImporter: importers.register,
    ...extra
  })
}

async function openWorkflow(data: Record<string, unknown>): Promise<boolean> {
  const workflow = await validateComfyWorkflow(data)
  if (!workflow) return false
  const opened = await useApp().loadGraphData(workflow)
  return opened !== false && opened !== undefined
}
