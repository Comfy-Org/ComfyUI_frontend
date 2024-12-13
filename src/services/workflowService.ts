import { downloadBlob } from '@/scripts/utils'
import { useSettingStore } from '@/stores/settingStore'
import { useWorkflowStore, ComfyWorkflow } from '@/stores/workflowStore'
import { showConfirmationDialog, showPromptDialog } from './dialogService'
import { app } from '@/scripts/app'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { LGraphCanvas } from '@comfyorg/litegraph'
import { toRaw } from 'vue'
import { ComfyWorkflowJSON } from '@/types/comfyWorkflow'
import { blankGraph, defaultGraph } from '@/scripts/defaultGraph'
import { appendJsonExt } from '@/utils/formatUtil'
import { t } from '@/i18n'
import { useToastStore } from '@/stores/toastStore'

async function getFilename(defaultName: string): Promise<string | null> {
  if (useSettingStore().get('Comfy.PromptFilename')) {
    let filename = await showPromptDialog({
      title: t('workflowService.exportWorkflow'),
      message: t('workflowService.enterFilename') + ':',
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
      title: t('workflowService.saveWorkflow'),
      message: t('workflowService.enterFilename') + ':',
      defaultValue: workflow.filename
    })
    if (!newFilename) return

    const newPath = workflow.directory + '/' + appendJsonExt(newFilename)
    const newKey = newPath.substring(ComfyWorkflow.basePath.length)
    const workflowStore = useWorkflowStore()
    const existingWorkflow = workflowStore.getWorkflowByPath(newPath)

    if (existingWorkflow && !existingWorkflow.isTemporary) {
      const res = await showConfirmationDialog({
        title: t('sideToolbar.workflowTab.confirmOverwriteTitle'),
        type: 'overwrite',
        message: t('sideToolbar.workflowTab.confirmOverwrite'),
        itemList: [newPath]
      })

      if (res !== true) return

      if (existingWorkflow.path === workflow.path) {
        await this.saveWorkflow(workflow)
        return
      }
      const deleted = await this.deleteWorkflow(existingWorkflow, true)
      if (!deleted) return
    }

    if (workflow.isTemporary) {
      await this.renameWorkflow(workflow, newPath)
      await workflowStore.saveWorkflow(workflow)
    } else {
      const tempWorkflow = workflowStore.createTemporary(
        newKey,
        workflow.activeState as ComfyWorkflowJSON
      )
      await this.openWorkflow(tempWorkflow)
      await workflowStore.saveWorkflow(tempWorkflow)
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

  /**
   * Reload the current workflow
   * This is used to refresh the node definitions update, e.g. when the locale changes.
   */
  async reloadCurrentWorkflow() {
    const workflow = useWorkflowStore().activeWorkflow
    if (workflow) {
      await this.openWorkflow(workflow, { force: true })
    }
  },

  /**
   * Open a workflow in the current workspace
   * @param workflow The workflow to open
   * @param options The options for opening the workflow
   */
  async openWorkflow(
    workflow: ComfyWorkflow,
    options: { force: boolean } = { force: false }
  ) {
    if (useWorkflowStore().isActive(workflow) && !options.force) return

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
  ): Promise<boolean> {
    if (!workflow.isLoaded) {
      return true
    }

    if (workflow.isModified && options.warnIfUnsaved) {
      const confirmed = await showConfirmationDialog({
        title: t('sideToolbar.workflowTab.dirtyCloseTitle'),
        type: 'dirtyClose',
        message: t('sideToolbar.workflowTab.dirtyClose'),
        itemList: [workflow.path]
      })
      // Cancel
      if (confirmed === null) return false

      if (confirmed === true) {
        await this.saveWorkflow(workflow)
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
    return true
  },

  async renameWorkflow(workflow: ComfyWorkflow, newPath: string) {
    await useWorkflowStore().renameWorkflow(workflow, newPath)
  },

  /**
   * Delete a workflow
   * @param workflow The workflow to delete
   * @returns `true` if the workflow was deleted, `false` if the user cancelled
   */
  async deleteWorkflow(
    workflow: ComfyWorkflow,
    silent = false
  ): Promise<boolean> {
    const bypassConfirm = !useSettingStore().get('Comfy.Workflow.ConfirmDelete')
    let confirmed: boolean | null = bypassConfirm || silent

    if (!confirmed) {
      confirmed = await showConfirmationDialog({
        title: t('sideToolbar.workflowTab.confirmDeleteTitle'),
        type: 'delete',
        message: t('sideToolbar.workflowTab.confirmDelete'),
        itemList: [workflow.path]
      })
      if (!confirmed) return false
    }

    const workflowStore = useWorkflowStore()
    if (workflowStore.isOpen(workflow)) {
      const closed = await this.closeWorkflow(workflow, {
        warnIfUnsaved: !confirmed
      })
      if (!closed) return false
    }
    await workflowStore.deleteWorkflow(workflow)
    if (!silent) {
      useToastStore().add({
        severity: 'info',
        summary: t('sideToolbar.workflowTab.deleted'),
        life: 1000
      })
    }
    return true
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
        ComfyWorkflow.basePath + appendJsonExt(value)
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
  },

  /**
   * Takes an existing workflow and duplicates it with a new name
   */
  async duplicateWorkflow(workflow: ComfyWorkflow) {
    const state = JSON.parse(JSON.stringify(workflow.activeState))
    await app.loadGraphData(state, true, true, workflow.filename)
  }
}
