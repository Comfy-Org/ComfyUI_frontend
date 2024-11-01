import { defineStore } from 'pinia'
import { computed, markRaw, ref } from 'vue'
import { buildTree } from '@/utils/treeUtil'
import { api } from '@/scripts/api'
import { UserFile } from './userFileStore'
import { ComfyWorkflowManager } from '@/scripts/workflows'
import { ChangeTracker } from '@/scripts/changeTracker'
import { ComfyWorkflowJSON } from '@/types/comfyWorkflow'
import { setStorageValue } from '@/scripts/utils'
import { useToastStore } from './toastStore'
import { appendJsonExt } from '@/utils/formatUtil'
import { UserDataFullInfo } from '@/types/apiTypes'
import { LGraph } from '@comfyorg/litegraph'
import { LGraphCanvas } from '@comfyorg/litegraph'
import { ISerialisedGraph } from '@comfyorg/litegraph/dist/types/serialisation'

export class ComfyWorkflow extends UserFile {
  isOpen: boolean = false
  manager: ComfyWorkflowManager
  changeTracker: ChangeTracker | null = null

  originalWorkflow: ComfyWorkflowJSON | null = null

  constructor(manager: ComfyWorkflowManager, options: UserDataFullInfo) {
    super('workflows/' + options.path, options.modified, options.size)
    this.manager = manager
  }

  get isBookmarked() {
    return this.manager.workflowBookmarkStore?.isBookmarked(this.path) ?? false
  }

  /**
   * @deprecated Use filename instead
   */
  get name() {
    return this.filename
  }

  get key() {
    return this.path.substring('workflows/'.length)
  }

  /**
   * Open the workflow in the graph editor. Set the workflow as the active workflow.
   * @returns this
   */
  async open() {
    if (this.isOpen) return this

    const loadFromRemote = !this.isLoaded
    if (loadFromRemote) {
      await this.load()
    }

    await this.manager.app.loadGraphData(
      this.changeTracker.activeState,
      /* clean=*/ true,
      /* restore_view=*/ true,
      this,
      {
        showMissingModelsDialog: loadFromRemote,
        showMissingNodesDialog: loadFromRemote
      }
    )

    this.isOpen = true
    return this
  }

  /**
   * Load the workflow content from remote storage.
   * @returns this
   */
  async load() {
    await super.load()
    this.changeTracker = markRaw(new ChangeTracker(this))
    return this
  }

  async getCurrentWorkflowState(): Promise<ComfyWorkflowJSON | null> {
    if (!this.isLoaded) return null
    return this.changeTracker?.activeState ?? null
  }

  async save() {
    this.content = JSON.stringify(await this.getCurrentWorkflowState())
    return await super.save()
  }

  async saveAs(path: string) {
    this.content = JSON.stringify(await this.getCurrentWorkflowState())
    return await super.saveAs('workflows/' + appendJsonExt(path))
  }

  async setBookmarked(value: boolean) {
    try {
      if (this.isBookmarked === value) return
      this.manager.workflowBookmarkStore?.setBookmarked(this.path, value)
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
        return this
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
      return this
    }

    if (this.isBookmarked) {
      await this.setBookmarked(false)
    }
    path = (await resp.json()).substring('workflows/'.length)
    if (this.isBookmarked) {
      await this.setBookmarked(true)
    }
    setStorageValue('Comfy.PreviousWorkflow', this.path ?? '')
    return this
  }

  async insert() {
    const data = this.originalWorkflow
    if (!data) return
    const old = localStorage.getItem('litegrapheditor_clipboard')
    const graph = new LGraph(data as unknown as ISerialisedGraph)
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
      await this.setBookmarked(false)
    }
    const resp = await api.deleteUserData('workflows/' + this.path)
    if (resp.status !== 204) {
      useToastStore().addAlert(
        `Error removing user data file '${this.path}': ${resp.status} ${resp.statusText}`
      )
    }

    this.manager.workflows.splice(this.manager.workflows.indexOf(this), 1)
  }
}

export const useWorkflowStore = defineStore('workflow', () => {
  const activeWorkflow = ref<ComfyWorkflow | null>(null)
  const workflowLookup = ref<Record<string, ComfyWorkflow>>({})
  const workflows = computed(() => Object.values(workflowLookup.value))
  const persistedWorkflows = computed(() =>
    workflows.value.filter((workflow) => workflow.isPersisted)
  )
  const openWorkflows = computed(() =>
    workflows.value.filter((workflow) => workflow.isOpen)
  )
  const bookmarkedWorkflows = computed(() =>
    workflows.value.filter((workflow) => workflow.isBookmarked)
  )
  const modifiedWorkflows = computed(() =>
    workflows.value.filter((workflow) => workflow.unsaved)
  )

  const buildWorkflowTree = (workflows: ComfyWorkflow[]) => {
    return buildTree(workflows, (workflow: ComfyWorkflow) =>
      workflow.key.split('/')
    )
  }
  const workflowsTree = computed(() =>
    buildWorkflowTree(persistedWorkflows.value)
  )
  // Bookmarked workflows tree is flat.
  const bookmarkedWorkflowsTree = computed(() =>
    buildTree(bookmarkedWorkflows.value, (workflow: ComfyWorkflow) => [
      workflow.path ?? 'temporary_workflow'
    ])
  )
  // Open workflows tree is flat.
  const openWorkflowsTree = computed(() =>
    buildTree(openWorkflows.value, (workflow: ComfyWorkflow) => [workflow.key])
  )

  const loadOpenedWorkflowIndexShift = async (shift: number) => {
    const index = openWorkflows.value.indexOf(
      activeWorkflow.value as ComfyWorkflow
    )
    if (index !== -1) {
      const length = openWorkflows.value.length
      const nextIndex = (index + shift + length) % length
      const nextWorkflow = openWorkflows.value[nextIndex]
      if (nextWorkflow) {
        await nextWorkflow.load()
      }
    }
  }

  const loadNextOpenedWorkflow = async () => {
    await loadOpenedWorkflowIndexShift(1)
  }

  const loadPreviousOpenedWorkflow = async () => {
    await loadOpenedWorkflowIndexShift(-1)
  }

  return {
    activeWorkflow,
    workflows,
    openWorkflows,
    bookmarkedWorkflows,
    modifiedWorkflows,
    workflowLookup,
    workflowsTree,
    bookmarkedWorkflowsTree,
    openWorkflowsTree,
    buildWorkflowTree,
    loadNextOpenedWorkflow,
    loadPreviousOpenedWorkflow
  }
})

export const useWorkflowBookmarkStore = defineStore('workflowBookmark', () => {
  const bookmarks = ref<Set<string>>(new Set())

  const isBookmarked = (path: string) => bookmarks.value.has(path)

  const loadBookmarks = async () => {
    const resp = await api.getUserData('workflows/.index.json')
    if (resp.status === 200) {
      const info = await resp.json()
      bookmarks.value = new Set(info?.favorites ?? [])
    }
  }

  const saveBookmarks = async () => {
    await api.storeUserData('workflows/.index.json', {
      favorites: Array.from(bookmarks.value)
    })
  }

  const setBookmarked = (path: string, value: boolean) => {
    if (value) {
      bookmarks.value.add(path)
    } else {
      bookmarks.value.delete(path)
    }
    saveBookmarks()
  }

  const toggleBookmarked = (path: string) => {
    setBookmarked(path, !bookmarks.value.has(path))
  }

  return {
    isBookmarked,
    loadBookmarks,
    saveBookmarks,
    setBookmarked,
    toggleBookmarked
  }
})
