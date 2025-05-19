import { LGraph, LGraphCanvas } from '@comfyorg/litegraph'
import type { SerialisableGraph, Vector2 } from '@comfyorg/litegraph'
import { toRaw } from 'vue'

import { t } from '@/i18n'
import { ComfyWorkflowJSON } from '@/schemas/comfyWorkflowSchema'
import { app } from '@/scripts/app'
import { blankGraph, defaultGraph } from '@/scripts/defaultGraph'
import { downloadBlob } from '@/scripts/utils'
import { useDomWidgetStore } from '@/stores/domWidgetStore'
import { useSettingStore } from '@/stores/settingStore'
import { useToastStore } from '@/stores/toastStore'
import { ComfyWorkflow, useWorkflowStore } from '@/stores/workflowStore'
import { useWorkspaceStore } from '@/stores/workspaceStore'
import { appendJsonExt, generateUUID } from '@/utils/formatUtil'

import { useDialogService } from './dialogService'

export const useWorkflowService = () => {
  const settingStore = useSettingStore()
  const workflowStore = useWorkflowStore()
  const toastStore = useToastStore()
  const dialogService = useDialogService()
  const domWidgetStore = useDomWidgetStore()

  async function getFilename(defaultName: string): Promise<string | null> {
    if (settingStore.get('Comfy.PromptFilename')) {
      let filename = await dialogService.prompt({
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

  /**
   * Adds scale and offset from litegraph canvas to the workflow JSON.
   * @param workflow The workflow to add the view restore data to
   */
  function addViewRestore(workflow: ComfyWorkflowJSON) {
    if (!settingStore.get('Comfy.EnableWorkflowViewRestore')) return

    const { offset, scale } = app.canvas.ds
    const [x, y] = offset

    workflow.extra ??= {}
    workflow.extra.ds = { scale, offset: [x, y] }
  }

  /**
   * Export the current workflow as a JSON file
   * @param filename The filename to save the workflow as
   * @param promptProperty The property of the prompt to export
   */
  const exportWorkflow = async (
    filename: string,
    promptProperty: 'workflow' | 'output'
  ): Promise<void> => {
    const workflow = workflowStore.activeWorkflow
    if (workflow?.path) {
      filename = workflow.filename
    }
    const p = await app.graphToPrompt()

    addViewRestore(p.workflow)
    const json = JSON.stringify(p[promptProperty], null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const file = await getFilename(filename)
    if (!file) return
    downloadBlob(file, blob)
  }
  /**
   * Save a workflow as a new file
   * @param workflow The workflow to save
   */
  const saveWorkflowAs = async (workflow: ComfyWorkflow) => {
    const newFilename = await dialogService.prompt({
      title: t('workflowService.saveWorkflow'),
      message: t('workflowService.enterFilename') + ':',
      defaultValue: workflow.filename
    })
    if (!newFilename) return

    const newPath = workflow.directory + '/' + appendJsonExt(newFilename)
    const newKey = newPath.substring(ComfyWorkflow.basePath.length)
    const existingWorkflow = workflowStore.getWorkflowByPath(newPath)

    if (existingWorkflow && !existingWorkflow.isTemporary) {
      const res = await dialogService.confirm({
        title: t('sideToolbar.workflowTab.confirmOverwriteTitle'),
        type: 'overwrite',
        message: t('sideToolbar.workflowTab.confirmOverwrite'),
        itemList: [newPath]
      })

      if (res !== true) return

      if (existingWorkflow.path === workflow.path) {
        await saveWorkflow(workflow)
        return
      }
      const deleted = await deleteWorkflow(existingWorkflow, true)
      if (!deleted) return
    }

    if (workflow.isTemporary) {
      await renameWorkflow(workflow, newPath)
      await workflowStore.saveWorkflow(workflow)
    } else {
      // Generate new id when saving existing workflow as a new file
      const id = generateUUID()
      const state = JSON.parse(
        JSON.stringify(workflow.activeState)
      ) as ComfyWorkflowJSON
      state.id = id

      const tempWorkflow = workflowStore.createTemporary(newKey, state)
      await openWorkflow(tempWorkflow)
      await workflowStore.saveWorkflow(tempWorkflow)
    }
  }

  /**
   * Save a workflow
   * @param workflow The workflow to save
   */
  const saveWorkflow = async (workflow: ComfyWorkflow) => {
    if (workflow.isTemporary) {
      await saveWorkflowAs(workflow)
    } else {
      await workflowStore.saveWorkflow(workflow)
    }
  }

  /**
   * Load the default workflow
   */
  const loadDefaultWorkflow = async () => {
    await app.loadGraphData(defaultGraph)
  }

  /**
   * Load a blank workflow
   */
  const loadBlankWorkflow = async () => {
    await app.loadGraphData(blankGraph)
  }

  /**
   * Reload the current workflow
   * This is used to refresh the node definitions update, e.g. when the locale changes.
   */
  const reloadCurrentWorkflow = async () => {
    const workflow = workflowStore.activeWorkflow
    if (workflow) {
      await openWorkflow(workflow, { force: true })
    }
  }

  /**
   * Open a workflow in the current workspace
   * @param workflow The workflow to open
   * @param options The options for opening the workflow
   */
  const openWorkflow = async (
    workflow: ComfyWorkflow,
    options: { force: boolean } = { force: false }
  ) => {
    if (workflowStore.isActive(workflow) && !options.force) return

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
        showMissingNodesDialog: loadFromRemote,
        checkForRerouteMigration: false
      }
    )
  }

  /**
   * Close a workflow with confirmation if there are unsaved changes
   * @param workflow The workflow to close
   * @returns true if the workflow was closed, false if the user cancelled
   */
  const closeWorkflow = async (
    workflow: ComfyWorkflow,
    options: { warnIfUnsaved: boolean; hint?: string } = {
      warnIfUnsaved: true
    }
  ): Promise<boolean> => {
    if (workflow.isModified && options.warnIfUnsaved) {
      const confirmed = await dialogService.confirm({
        title: t('sideToolbar.workflowTab.dirtyCloseTitle'),
        type: 'dirtyClose',
        message: t('sideToolbar.workflowTab.dirtyClose'),
        itemList: [workflow.path],
        hint: options.hint
      })
      // Cancel
      if (confirmed === null) return false

      if (confirmed === true) {
        await saveWorkflow(workflow)
      }
    }

    // If this is the last workflow, create a new default temporary workflow
    if (workflowStore.openWorkflows.length === 1) {
      await loadDefaultWorkflow()
    }
    // If this is the active workflow, load the next workflow
    if (workflowStore.isActive(workflow)) {
      await loadNextOpenedWorkflow()
    }

    await workflowStore.closeWorkflow(workflow)
    return true
  }

  const renameWorkflow = async (workflow: ComfyWorkflow, newPath: string) => {
    await workflowStore.renameWorkflow(workflow, newPath)
  }

  /**
   * Delete a workflow
   * @param workflow The workflow to delete
   * @returns `true` if the workflow was deleted, `false` if the user cancelled
   */
  const deleteWorkflow = async (
    workflow: ComfyWorkflow,
    silent = false
  ): Promise<boolean> => {
    const bypassConfirm = !settingStore.get('Comfy.Workflow.ConfirmDelete')
    let confirmed: boolean | null = bypassConfirm || silent

    if (!confirmed) {
      confirmed = await dialogService.confirm({
        title: t('sideToolbar.workflowTab.confirmDeleteTitle'),
        type: 'delete',
        message: t('sideToolbar.workflowTab.confirmDelete'),
        itemList: [workflow.path]
      })
      if (!confirmed) return false
    }

    if (workflowStore.isOpen(workflow)) {
      const closed = await closeWorkflow(workflow, {
        warnIfUnsaved: !confirmed
      })
      if (!closed) return false
    }
    await workflowStore.deleteWorkflow(workflow)
    if (!silent) {
      toastStore.add({
        severity: 'info',
        summary: t('sideToolbar.workflowTab.deleted'),
        life: 1000
      })
    }
    return true
  }

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
  const beforeLoadNewGraph = () => {
    // Use workspaceStore here as it is patched in unit tests.
    useWorkspaceStore().workflow.activeWorkflow?.changeTracker?.store()
    domWidgetStore.clear()
  }

  /**
   * Set the active workflow after the new graph is loaded.
   *
   * The call relationship is
   * useWorkflowService().openWorkflow -> app.loadGraphData -> useWorkflowService().afterLoadNewGraph
   * app.loadApiJson -> useWorkflowService().afterLoadNewGraph
   * app.importA1111 -> useWorkflowService().afterLoadNewGraph
   *
   * @param value The value to set as the active workflow.
   * @param workflowData The initial workflow data loaded to the graph editor.
   */
  const afterLoadNewGraph = async (
    value: string | ComfyWorkflow | null,
    workflowData: ComfyWorkflowJSON
  ) => {
    // Use workspaceStore here as it is patched in unit tests.
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
  }

  /**
   * Insert the given workflow into the current graph editor.
   */
  const insertWorkflow = async (
    workflow: ComfyWorkflow,
    options: { position?: Vector2 } = {}
  ) => {
    const loadedWorkflow = await workflow.load()
    const workflowJSON = toRaw(loadedWorkflow.initialState)
    const old = localStorage.getItem('litegrapheditor_clipboard')
    // unknown conversion: ComfyWorkflowJSON is stricter than LiteGraph's
    // serialisation schema.
    const graph = new LGraph(workflowJSON as unknown as SerialisableGraph)
    const canvasElement = document.createElement('canvas')
    const canvas = new LGraphCanvas(canvasElement, graph, {
      skip_events: true,
      skip_render: true
    })
    canvas.selectItems()
    canvas.copyToClipboard()
    app.canvas.pasteFromClipboard(options)
    if (old !== null) {
      localStorage.setItem('litegrapheditor_clipboard', old)
    }
  }

  const loadNextOpenedWorkflow = async () => {
    const nextWorkflow = workflowStore.openedWorkflowIndexShift(1)
    if (nextWorkflow) {
      await openWorkflow(nextWorkflow)
    }
  }

  const loadPreviousOpenedWorkflow = async () => {
    const previousWorkflow = workflowStore.openedWorkflowIndexShift(-1)
    if (previousWorkflow) {
      await openWorkflow(previousWorkflow)
    }
  }

  /**
   * Takes an existing workflow and duplicates it with a new name
   */
  const duplicateWorkflow = async (workflow: ComfyWorkflow) => {
    const state = JSON.parse(JSON.stringify(workflow.activeState))
    const suffix = workflow.isPersisted ? ' (Copy)' : ''
    // Remove the suffix `(2)` or similar
    const filename = workflow.filename.replace(/\s*\(\d+\)$/, '') + suffix

    await app.loadGraphData(state, true, true, filename)
  }

  return {
    exportWorkflow,
    saveWorkflowAs,
    saveWorkflow,
    loadDefaultWorkflow,
    loadBlankWorkflow,
    reloadCurrentWorkflow,
    openWorkflow,
    closeWorkflow,
    renameWorkflow,
    deleteWorkflow,
    insertWorkflow,
    loadNextOpenedWorkflow,
    loadPreviousOpenedWorkflow,
    duplicateWorkflow,
    afterLoadNewGraph,
    beforeLoadNewGraph
  }
}
