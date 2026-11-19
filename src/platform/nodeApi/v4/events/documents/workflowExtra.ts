import { isGraphLoading } from '@/core/graph/graphLoadState'
import { isStoreKey } from '@/platform/nodeApi/v4/checkedFields'
import type { LGraph } from '@/lib/litegraph/src/LGraph'
import { canCaptureCanvas } from '@/platform/workflow/core/canvasTrackerOwnership'
import type { WorkflowChangeTracker } from '@/platform/workflow/management/stores/comfyWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
import { savedCopier } from '@/platform/nodeApi/shared/savedCopy'
import { savableCopy } from '@/platform/nodeApi/v4/edit/checkedArguments'
import type { EditRunner } from '@/platform/nodeApi/v4/edit/editRunner'
import type { WorkflowHandle } from '@/platform/nodeApi/v4/types'

import type { Documents } from './documents'

export type WorkflowExtra = Pick<WorkflowHandle, 'getExtra' | 'setExtra'>

export function createWorkflowExtra(
  changeTrackerOf: Documents['changeTrackerOf'],
  getGraph: () => LGraph | null,
  asOneStep: EditRunner['batch']
): WorkflowExtra {
  const copyOfSaved = savedCopier()

  function rootOnScreen(tracker: WorkflowChangeTracker): LGraph | undefined {
    const root = getGraph()?.rootGraph
    const onScreen =
      useWorkflowStore().activeWorkflow?.changeTracker === tracker &&
      canCaptureCanvas(tracker) &&
      !isGraphLoading(root)
    return onScreen ? root : undefined
  }

  return {
    getExtra(document, key) {
      const name = checkedKey('workflow.getExtra', key)
      const tracker = changeTrackerOf('workflow.getExtra', document)
      if (!tracker) return undefined
      const extra = rootOnScreen(tracker)?.extra ?? tracker.activeState.extra
      return extra && Object.hasOwn(extra, name)
        ? copyOfSaved('workflow.getExtra', extra[name])
        : undefined
    },

    setExtra(document, key, value) {
      const name = checkedKey('workflow.setExtra', key)
      if (!isStoreKey(name)) {
        throw invalidArgument('workflow.setExtra', 'a key', name)
      }
      const saved =
        value === undefined
          ? undefined
          : savableCopy('workflow.setExtra', 'a value', value)
      const tracker = changeTrackerOf('workflow.setExtra', document)
      const root = tracker && rootOnScreen(tracker)
      if (!root) return false
      asOneStep(() => {
        if (saved === undefined) delete root.extra[name]
        else root.extra[name] = saved
      })
      return true
    }
  }
}

function checkedKey(member: string, key: unknown): string {
  if (typeof key !== 'string') throw invalidArgument(member, 'a key', key)
  return key
}
