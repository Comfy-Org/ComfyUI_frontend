import { downloadBlob } from '@/scripts/utils'
import { useSettingStore } from '@/stores/settingStore'
import { ComfyAsyncDialog } from '@/scripts/ui/components/asyncDialog'
import { useWorkflowStore, ComfyWorkflow } from '@/stores/workflowStore'
import { showPromptDialog } from './dialogService'
import { app } from '@/scripts/app'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { LGraphCanvas } from '@comfyorg/litegraph'
import { toRaw } from 'vue'
import { ComfyWorkflowJSON } from '@/types/comfyWorkflow'
import { blankGraph, defaultGraph } from '@/scripts/defaultGraph'
import { appendJsonExt } from '@/utils/formatUtil'

async function getFilename(defaultName: string): Promise<string | null> {
  if (useSettingStore().get('Comfy.PromptFilename')) {
    let filename = await showPromptDialog({
      title: 'Export Workflow',
      message: 'Enter the filename:',
      defaultValue: defaultName
    })
    if (!filename) return null
    if (!filename.toLowerCase().endsWith('.json')) {
      filename += '.json'
    }
    return filename
  }
  return defaultName
}

// TODO(huchenlei): Auto Error Handling for all methods.
export const workflowService = {
  /**
   * Export the current workflow as a JSON file
   * @param filename The filename to save the workflow as
   * @param promptProperty The property of the prompt to export
   */
  async exportWorkflow(
    filename: string,
    promptProperty: 'workflow' | 'output'
  ): Promise<void> {
    const workflow = useWorkflowStore().activeWorkflow
    if (workflow?.path) {
      filename = workflow.filename
    }
    const p = await app.graphToPrompt()
    const json = JSON.stringify(p[promptProperty], null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const file = await getFilename(filename)
    if (!file) return
    downloadBlob(file, blob)
  },
  /**
   * Save a workflow as a new file
   * @param workflow The workflow to save
   */
  async saveWorkflowAs(workflow: ComfyWorkflow) {
    const newFilename = await showPromptDialog({
      title: 'Save workflow',
      message: 'Enter the filename:',
      defaultValue: workflow.filename
    })
    if (!newFilename) return

    if (workflow.isTemporary) {
      await this.renameWorkflow(workflow, newFilename)
      await useWorkflowStore().saveWorkflow(workflow)
    } else {
      const tempWorkflow = useWorkflowStore().createTemporary(
        (workflow.directory + '/' + appendJsonExt(newFilename)).substring(
          'workflows/'.length
        ),
        workflow.activeState as ComfyWorkflowJSON
      )
      await this.openWorkflow(tempWorkflow)
      await useWorkflowStore().saveWorkflow(tempWorkflow)
    }
  },

  /**
   * Save a workflow
   * @param workflow The workflow to save
   */
  async saveWorkflow(workflow: ComfyWorkflow) {
    if (workflow.isTemporary) {
      await this.saveWorkflowAs(workflow)
    } else {
      await useWorkflowStore().saveWorkflow(workflow)
    }
  },

  /**
   * Load the default workflow
   */
  async loadDefaultWorkflow() {
    await app.loadGraphData(defaultGraph)
  },

  /**
   * Load a blank workflow
   */
  async loadBlankWorkflow() {
    await app.loadGraphData(blankGraph)
  },

  async openWorkflow(workflow: ComfyWorkflow) {
    if (useWorkflowStore().isActive(workflow)) return

    const loadFromRemote = !workflow.isLoaded
    if (loadFromRemote) {
      await workflow.load()
    }

    await app.loadGraphData(
      toRaw(workflow.activeState) as ComfyWorkflowJSON,
      /* clean=*/ true,
      /* restore_view=*/ true,
      workflow,
      {
        showMissingModelsDialog: loadFromRemote,
        showMissingNodesDialog: loadFromRemote
      }
    )
  },

  /**
   * Close a workflow with confirmation if there are unsaved changes
   * @param workflow The workflow to close
   * @returns true if the workflow was closed, false if the user cancelled
   */
  async closeWorkflow(
    workflow: ComfyWorkflow,
    options: { warnIfUnsaved: boolean } = { warnIfUnsaved: true }
  ): Promise<void> {
    if (!workflow.isLoaded) {
      return
    }

    if (workflow.isModified && options.warnIfUnsaved) {
      const res = (await ComfyAsyncDialog.prompt({
        title: 'Save Changes?',
        message: `Do you want to save changes to "${workflow.path}" before closing?`,
        actions: ['Yes', 'No', 'Cancel']
      })) as 'Yes' | 'No' | 'Cancel'

      if (res === 'Yes') {
        await this.saveWorkflow(workflow)
      } else if (res === 'Cancel') {
        return
      }
    }

    const workflowStore = useWorkflowStore()
    // If this is the last workflow, create a new default temporary workflow
    if (workflowStore.openWorkflows.length === 1) {
      await this.loadDefaultWorkflow()
    }
    // If this is the active workflow, load the next workflow
    if (workflowStore.isActive(workflow)) {
      await this.loadNextOpenedWorkflow()
    }

    await workflowStore.closeWorkflow(workflow)
  },

  async renameWorkflow(workflow: ComfyWorkflow, newName: string) {
    await useWorkflowStore().renameWorkflow(workflow, newName)
  },

  async deleteWorkflow(workflow: ComfyWorkflow) {
    const workflowStore = useWorkflowStore()
    if (workflowStore.isOpen(workflow)) {
      await this.closeWorkflow(workflow)
    }
    await workflowStore.deleteWorkflow(workflow)
  },

  /**
   * This method is called before loading a new graph.
   * There are 3 major functions that loads a new graph to the graph editor:
   * 1. loadGraphData
   * 2. loadApiJson
   * 3. importA1111
   *
   * This function is used to save the current workflow states before loading
   * a new graph.
   */
  beforeLoadNewGraph() {
    // Use workspaceStore here as it is patched in jest tests.
    const workflowStore = useWorkspaceStore().workflow
    const activeWorkflow = workflowStore.activeWorkflow
    if (activeWorkflow) {
      activeWorkflow.changeTracker.store()
    }
  },

  /**
   * Set the active workflow after the new graph is loaded.
   *
   * The call relationship is
   * workflowService.openWorkflow -> app.loadGraphData -> workflowService.afterLoadNewGraph
   * app.loadApiJson -> workflowService.afterLoadNewGraph
   * app.importA1111 -> workflowService.afterLoadNewGraph
   *
   * @param value The value to set as the active workflow.
   * @param workflowData The initial workflow data loaded to the graph editor.
   */
  async afterLoadNewGraph(
    value: string | ComfyWorkflow | null,
    workflowData: ComfyWorkflowJSON
  ) {
    // Use workspaceStore here as it is patched in jest tests.
    const workflowStore = useWorkspaceStore().workflow
    if (typeof value === 'string') {
      const workflow = workflowStore.getWorkflowByPath(
        'workflows/' + appendJsonExt(value)
      )
      if (workflow?.isPersisted) {
        const loadedWorkflow = await workflowStore.openWorkflow(workflow)
        loadedWorkflow.changeTracker.restore()
        loadedWorkflow.changeTracker.reset(workflowData)
        return
      }
    }

    if (value === null || typeof value === 'string') {
      const path = value as string | null
      const tempWorkflow = workflowStore.createTemporary(
        path ? appendJsonExt(path) : undefined,
        workflowData
      )
      await workflowStore.openWorkflow(tempWorkflow)
      return
    }

    // value is a ComfyWorkflow.
    const loadedWorkflow = await workflowStore.openWorkflow(value)
    loadedWorkflow.changeTracker.reset(workflowData)
    loadedWorkflow.changeTracker.restore()
  },

  /**
   * Insert the given workflow into the current graph editor.
   */
  async insertWorkflow(workflow: ComfyWorkflow) {
    const loadedWorkflow = await workflow.load()
    const data = loadedWorkflow.initialState
    const old = localStorage.getItem('litegrapheditor_clipboard')
    // @ts-expect-error: zod issue. Should be fixed after enable ts-strict globally
    const graph = new LGraph(data)
    const canvasElement = document.createElement('canvas')
    const canvas = new LGraphCanvas(canvasElement, graph, {
      skip_events: true,
      skip_render: true
    })
    canvas.selectNodes()
    canvas.copyToClipboard()
    app.canvas.pasteFromClipboard()
    if (old !== null) {
      localStorage.setItem('litegrapheditor_clipboard', old)
    }
  },

  async loadNextOpenedWorkflow() {
    const nextWorkflow = useWorkflowStore().openedWorkflowIndexShift(1)
    if (nextWorkflow) {
      await this.openWorkflow(nextWorkflow)
    }
  },

  async loadPreviousOpenedWorkflow() {
    const previousWorkflow = useWorkflowStore().openedWorkflowIndexShift(-1)
    if (previousWorkflow) {
      await this.openWorkflow(previousWorkflow)
    }
  }
}
