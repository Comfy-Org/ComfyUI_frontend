// @ts-strict-ignore
import type { ComfyApp } from './app'
import { api } from './api'
import { ChangeTracker } from './changeTracker'
import { ComfyAsyncDialog } from './ui/components/asyncDialog'
import { setStorageValue } from './utils'
import { LGraphCanvas, LGraph } from '@comfyorg/litegraph'
import { appendJsonExt, trimJsonExt } from '@/utils/formatUtil'
import {
  useWorkflowStore,
  useWorkflowBookmarkStore
} from '@/stores/workflowStore'
import { useExecutionStore } from '@/stores/executionStore'
import { markRaw, toRaw } from 'vue'
import { UserDataFullInfo } from '@/types/apiTypes'
import { useToastStore } from '@/stores/toastStore'
import { showPromptDialog } from '@/services/dialogService'

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

  async loadWorkflows() {
    try {
      const [files, _] = await Promise.all([
        api.listUserDataFullInfo('workflows'),
        this.workflowBookmarkStore?.loadBookmarks()
      ])

      files.forEach((file: UserDataFullInfo) => {
        let workflow = this.workflowLookup[file.path]
        if (!workflow) {
          workflow = new ComfyWorkflow(this, file.path, file.path.split('/'))
          this.workflowLookup[workflow.path] = workflow
        }
      })
    } catch (error) {
      useToastStore().addAlert(
        'Error loading workflows: ' + (error.message ?? error)
      )
    }
  }

  createTemporary(path?: string): ComfyWorkflow {
    const workflow = new ComfyWorkflow(
      this,
      path ??
        `Unsaved Workflow${
          this.#unsavedCount++ ? ` (${this.#unsavedCount})` : ''
        }`
    )
    this.workflowLookup[workflow.key] = workflow
    return workflow
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

    if (!workflow || typeof workflow === 'string') {
      workflow = this.createTemporary(workflow)
    }

    if (!workflow.isOpen) {
      // Opening a new workflow
      workflow.track()
    }

    this._activeWorkflow = workflow

    setStorageValue('Comfy.PreviousWorkflow', this.activeWorkflow.path ?? '')
    this.dispatchEvent(new CustomEvent('changeWorkflow'))
  }

  storePrompt({ nodes, id }) {
    this.executionStore?.storePrompt({
      nodes,
      id,
      workflow: this.activeWorkflow
    })
  }

  async closeWorkflow(workflow: ComfyWorkflow, warnIfUnsaved: boolean = true) {
    if (!workflow.isOpen) {
      return true
    }
    if (workflow.unsaved && warnIfUnsaved) {
      const res = await ComfyAsyncDialog.prompt({
        title: 'Save Changes?',
        message: `Do you want to save changes to "${workflow.path ?? workflow.name}" before closing?`,
        actions: ['Yes', 'No', 'Cancel']
      })
      if (res === 'Yes') {
        const active = this.activeWorkflow
        if (active !== workflow) {
          // We need to switch to the workflow to save it
          await workflow.load()
        }

        if (!(await workflow.save())) {
          // Save was canceled, restore the previous workflow
          if (active !== workflow) {
            await active.load()
          }
          return
        }
      } else if (res === 'Cancel') {
        return
      }
    }
    workflow.changeTracker = null
    workflow.isOpen = false
    if (this.openWorkflows.length > 0) {
      this._activeWorkflow = this.openWorkflows[0]
      await this._activeWorkflow.load()
    } else {
      // Load default
      await this.app.loadGraphData()
    }
  }
}

export class ComfyWorkflow {
  name: string
  path: string | null
  pathParts: string[] | null
  unsaved = false
  // Raw
  manager: ComfyWorkflowManager
  changeTracker: ChangeTracker | null = null
  isOpen: boolean = false

  get isTemporary() {
    return !this.path
  }

  get isPersisted() {
    return !this.isTemporary
  }

  get key() {
    return this.pathParts?.join('/') ?? this.name + '.json'
  }

  get isBookmarked() {
    return this.manager.workflowBookmarkStore?.isBookmarked(this.path) ?? false
  }

  constructor(
    manager: ComfyWorkflowManager,
    path: string,
    pathParts?: string[]
  ) {
    this.manager = markRaw(manager)
    if (pathParts) {
      this.updatePath(path, pathParts)
    } else {
      this.name = path
      this.unsaved = true
    }
  }

  private updatePath(path: string, pathParts: string[]) {
    this.path = path

    if (!pathParts) {
      if (!path.includes('\\')) {
        pathParts = path.split('/')
      } else {
        pathParts = path.split('\\')
      }
    }

    this.pathParts = pathParts
    this.name = trimJsonExt(pathParts[pathParts.length - 1])
  }

  async getWorkflowData() {
    const resp = await api.getUserData('workflows/' + this.path)
    if (resp.status !== 200) {
      useToastStore().addAlert(
        `Error loading workflow file '${this.path}': ${resp.status} ${resp.statusText}`
      )
      return
    }
    return await resp.json()
  }

  async load() {
    if (this.isOpen) {
      await this.manager.app.loadGraphData(
        this.changeTracker.activeState,
        true,
        true,
        this,
        {
          showMissingModelsDialog: false,
          showMissingNodesDialog: false
        }
      )
    } else {
      const data = await this.getWorkflowData()
      if (!data) return
      await this.manager.app.loadGraphData(data, true, true, this)
    }
  }

  async save(saveAs = false) {
    const createNewFile = !this.path || saveAs
    return !!(await this._save(
      createNewFile ? null : this.path,
      /* overwrite */ !createNewFile
    ))
  }

  async favorite(value: boolean) {
    try {
      if (this.isBookmarked === value) return
      this.manager.workflowBookmarkStore?.setBookmarked(this.path, value)
      this.manager.dispatchEvent(new CustomEvent('favorite', { detail: this }))
    } catch (error) {
      useToastStore().addAlert(
        'Error favoriting workflow ' +
          this.path +
          '\n' +
          (error.message ?? error)
      )
    }
  }

  async rename(path: string) {
    path = appendJsonExt(path)
    let resp = await api.moveUserData(
      'workflows/' + this.path,
      'workflows/' + path
    )

    if (resp.status === 409) {
      if (
        !confirm(
          `Workflow '${path}' already exists, do you want to overwrite it?`
        )
      )
        return resp
      resp = await api.moveUserData(
        'workflows/' + this.path,
        'workflows/' + path,
        { overwrite: true }
      )
    }

    if (resp.status !== 200) {
      useToastStore().addAlert(
        `Error renaming workflow file '${this.path}': ${resp.status} ${resp.statusText}`
      )
      return
    }

    if (this.isBookmarked) {
      await this.favorite(false)
    }
    path = (await resp.json()).substring('workflows/'.length)
    this.updatePath(path, null)
    if (this.isBookmarked) {
      await this.favorite(true)
    }
    this.manager.dispatchEvent(new CustomEvent('rename', { detail: this }))
    setStorageValue('Comfy.PreviousWorkflow', this.path ?? '')
  }

  async insert() {
    const data = await this.getWorkflowData()
    if (!data) return

    const old = localStorage.getItem('litegrapheditor_clipboard')
    const graph = new LGraph(data)
    const canvas = new LGraphCanvas(null, graph, {
      skip_events: true,
      skip_render: true
    })
    canvas.selectNodes()
    canvas.copyToClipboard()
    this.manager.app.canvas.pasteFromClipboard()
    localStorage.setItem('litegrapheditor_clipboard', old)
  }

  async delete() {
    // TODO: fix delete of current workflow - should mark workflow as unsaved and when saving use old name by default

    if (this.isBookmarked) {
      await this.favorite(false)
    }
    const resp = await api.deleteUserData('workflows/' + this.path)
    if (resp.status !== 204) {
      useToastStore().addAlert(
        `Error removing user data file '${this.path}': ${resp.status} ${resp.statusText}`
      )
    }

    this.unsaved = true
    this.path = null
    this.pathParts = null
    this.manager.workflows.splice(this.manager.workflows.indexOf(this), 1)
    this.manager.dispatchEvent(new CustomEvent('delete', { detail: this }))
  }

  track() {
    if (this.changeTracker) {
      this.changeTracker.restore()
    } else {
      this.changeTracker = markRaw(new ChangeTracker(this))
    }
    this.isOpen = true
  }

  private async _save(path: string | null, overwrite: boolean) {
    if (!path) {
      path = await showPromptDialog({
        title: 'Save workflow',
        message: 'Enter the filename:',
        defaultValue: trimJsonExt(this.path) ?? this.name ?? 'workflow'
      })
      if (!path) return
    }

    path = appendJsonExt(path)

    const workflow = this.manager.app.serializeGraph()
    const json = JSON.stringify(workflow, null, 2)
    let resp = await api.storeUserData('workflows/' + path, json, {
      stringify: false,
      throwOnError: false,
      overwrite
    })
    if (resp.status === 409) {
      if (
        !confirm(
          `Workflow '${path}' already exists, do you want to overwrite it?`
        )
      )
        return
      resp = await api.storeUserData('workflows/' + path, json, {
        stringify: false
      })
    }

    if (resp.status !== 200) {
      useToastStore().addAlert(
        `Error saving workflow '${this.path}': ${resp.status} ${resp.statusText}`
      )
      return
    }

    path = (await resp.json()).substring('workflows/'.length)

    if (!this.path) {
      // Saved new workflow, patch this instance
      const oldKey = this.key
      this.updatePath(path, null)

      // Update workflowLookup: change the key from the old unsaved path to the new saved path
      delete this.manager.workflowStore.workflowLookup[oldKey]
      this.manager.workflowStore.workflowLookup[this.key] = this

      await this.manager.loadWorkflows()
      this.unsaved = false
      this.manager.dispatchEvent(new CustomEvent('rename', { detail: this }))
      setStorageValue('Comfy.PreviousWorkflow', this.path ?? '')
    } else if (path !== this.path) {
      // Saved as, open the new copy
      await this.manager.loadWorkflows()
      const workflow = this.manager.workflowLookup[path]
      await workflow.load()
    } else {
      // Normal save
      this.unsaved = false
      this.manager.dispatchEvent(new CustomEvent('save', { detail: this }))
    }

    return true
  }
}
