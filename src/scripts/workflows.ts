// @ts-strict-ignore
import type { ComfyApp } from './app'
import { ChangeTracker } from './changeTracker'
import { setStorageValue } from './utils'
import {
  useWorkflowStore,
  useWorkflowBookmarkStore,
  ComfyWorkflow
} from '@/stores/workflowStore'
import { useExecutionStore } from '@/stores/executionStore'
import { toRaw } from 'vue'

export class ComfyWorkflowManager extends EventTarget {
  executionStore: ReturnType<typeof useExecutionStore> | null
  workflowStore: ReturnType<typeof useWorkflowStore> | null
  workflowBookmarkStore: ReturnType<typeof useWorkflowBookmarkStore> | null

  app: ComfyApp
  #unsavedCount = 0

  get workflowLookup(): Record<string, ComfyWorkflow> {
    return this.workflowStore?.workflowLookup ?? {}
  }

  get workflows(): ComfyWorkflow[] {
    return this.workflowStore?.workflows ?? []
  }

  get openWorkflows(): ComfyWorkflow[] {
    return (this.workflowStore?.openWorkflows ?? []) as ComfyWorkflow[]
  }

  get _activeWorkflow(): ComfyWorkflow | null {
    if (!this.app.vueAppReady) return null
    return this.workflowStore!.activeWorkflow as ComfyWorkflow | null
  }

  set _activeWorkflow(workflow: ComfyWorkflow | null) {
    if (!this.app.vueAppReady) return
    this.workflowStore!.activeWorkflow = workflow ? workflow : null
  }

  get activeWorkflow(): ComfyWorkflow | null {
    return this._activeWorkflow ?? this.openWorkflows[0]
  }

  get activePromptId() {
    return this.executionStore?.activePromptId
  }

  get activePrompt() {
    return this.executionStore?.activePrompt
  }

  constructor(app: ComfyApp) {
    super()
    this.app = app
    ChangeTracker.init(app)
  }

  /**
   * @param {string | ComfyWorkflow | null} workflow
   */
  setWorkflow(workflow) {
    if (workflow && typeof workflow === 'string') {
      const found = this.workflows.find((w) => w.path === workflow)
      if (found) {
        workflow = found
        workflow.unsaved = !workflow
      }
    }

    if (!(toRaw(workflow) instanceof ComfyWorkflow)) {
      // Still not found, either reloading a deleted workflow or blank
      workflow = new ComfyWorkflow(
        workflow ||
          'Unsaved Workflow' +
            (this.#unsavedCount++ ? ` (${this.#unsavedCount})` : '')
      )
      this.workflowLookup[workflow.key] = workflow
    }

    this._activeWorkflow = workflow

    setStorageValue('Comfy.PreviousWorkflow', this.activeWorkflow.path ?? '')
  }
}
