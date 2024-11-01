import { defineStore } from 'pinia'
import { computed, markRaw, ref, toRaw } from 'vue'
import { buildTree } from '@/utils/treeUtil'
import { api } from '@/scripts/api'
import { UserFile, useUserFileStore } from './userFileStore'
import { ChangeTracker } from '@/scripts/changeTracker'
import { ComfyWorkflowJSON } from '@/types/comfyWorkflow'
import { appendJsonExt } from '@/utils/formatUtil'
import { LGraph } from '@comfyorg/litegraph'
import { LGraphCanvas } from '@comfyorg/litegraph'
import { app } from '@/scripts/app'
import { useErrorHandling } from '@/hooks/errorHooks'
import { defaultGraph, defaultGraphJSON } from '@/scripts/defaultGraph'

export class ComfyWorkflow extends UserFile {
  changeTracker: ChangeTracker | null = null
  originalWorkflow: ComfyWorkflowJSON | null = null

  /**
   * @param options The path, modified, and size of the workflow.
   * Note: path is the full path, including the 'workflows/' prefix.
   */
  constructor(options: { path: string; modified: number; size: number }) {
    super(options.path, options.modified, options.size)
  }

  get isBookmarked() {
    return useWorkflowBookmarkStore().isBookmarked(this.path)
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
   * Whether the workflow is the active workflow currently being edited.
   */
  isActive() {
    return useWorkflowStore().activeWorkflow?.path === this.path
  }

  /**
   * Open the workflow in the graph editor. Set the workflow as the active workflow.
   * @returns this
   */
  async open() {
    await useWorkflowStore().openWorkflow(this)
    return this
  }

  /**
   * Close the workflow. If this is the active workflow, load the next workflow.
   * @returns this
   */
  async close() {
    await useWorkflowStore().closeWorkflow(this)
    return this
  }

  /**
   * Load the workflow content from remote storage.
   * @returns this
   */
  async load() {
    await super.load()
    if (this.isTemporary) {
      this.originalContent = defaultGraphJSON
      this.originalWorkflow = defaultGraph
    } else {
      this.originalWorkflow = JSON.parse(this.originalContent)
    }

    const changeTracker = markRaw(new ChangeTracker(this))
    changeTracker.activeState = toRaw(this.originalWorkflow)
    this.changeTracker = changeTracker
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
    if (this.isBookmarked === value) return
    useWorkflowBookmarkStore().setBookmarked(this.path, value)
  }

  async rename(newName: string) {
    const newPath = this.directory + '/' + appendJsonExt(newName)
    return await super.rename(newPath)
  }

  async insert() {
    const data = this.originalWorkflow
    if (!data) return
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
  }

  async delete() {
    if (this.isBookmarked) {
      await this.setBookmarked(false)
    }
    await super.delete()
  }
}

export const useWorkflowStore = defineStore('workflow', () => {
  /**
   * The active workflow currently being edited.
   */
  const activeWorkflow = ref<ComfyWorkflow | null>(null)
  /**
   * The paths of the open workflows. It is setup as a ref to allow user
   * to reorder the workflows opened.
   */
  const openWorkflowPaths = ref<string[]>([])
  const openWorkflows = computed(() =>
    openWorkflowPaths.value.map((path) => workflowLookup.value[path])
  )
  /**
   * The temporary workflows that are not saved to remote storage.
   */
  const temporaryWorkflows = ref<Set<ComfyWorkflow>>(new Set())

  /**
   * Open the workflow in the graph editor. Set the workflow as the active
   * workflow.
   * @param workflow The workflow to open.
   * @param options.skipGraphLoad Whether to skip loading the graph data.
   * This is used to avoid circular loading as loadGraphData also calls
   * openWorkflow internally.
   */
  const openWorkflow = async (
    workflow: ComfyWorkflow,
    { skipGraphLoad = false }: { skipGraphLoad?: boolean } = {}
  ) => {
    if (workflow.isActive()) return

    const loadFromRemote = !workflow.isLoaded
    if (loadFromRemote) {
      await workflow.load()
      openWorkflowPaths.value.push(workflow.path)
    }

    if (!skipGraphLoad) {
      await app.loadGraphData(
        workflow.changeTracker!.activeState as ComfyWorkflowJSON,
        /* clean=*/ true,
        /* restore_view=*/ true,
        workflow,
        {
          showMissingModelsDialog: loadFromRemote,
          showMissingNodesDialog: loadFromRemote
        }
      )
    }

    activeWorkflow.value = workflow
  }

  const createTemporary = (path?: string) => {
    const fullPath =
      'workflows/' + (path ?? 'temporary_' + Date.now() + '.json')
    const workflow = new ComfyWorkflow({
      path: fullPath,
      modified: Date.now(),
      size: 0
    })
    temporaryWorkflows.value.add(workflow)
    return workflow
  }

  const closeWorkflow = async (workflow: ComfyWorkflow) => {
    // If this is the last workflow, create a new blank temporary workflow
    if (openWorkflowPaths.value.length === 1) {
      await openWorkflow(createTemporary())
    }
    // If this is the active workflow, load the next workflow
    if (workflow.isActive()) {
      await loadNextOpenedWorkflow()
    }
    openWorkflowPaths.value = openWorkflowPaths.value.filter(
      (path) => path !== workflow.path
    )
    if (workflow.isTemporary) {
      temporaryWorkflows.value.delete(workflow)
    } else {
      workflow.unload()
    }
  }

  /**
   * Load the workflow at the given index shift from the active workflow.
   * @param shift The shift to the next workflow. Positive for next, negative for previous.
   */
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

  const userFileStore = useUserFileStore()
  const { wrapWithErrorHandlingAsync } = useErrorHandling()

  const persistedWorkflows = computed(() => {
    return userFileStore.userFiles
      .filter((file) => file.path.startsWith('workflows/'))
      .map(
        (file) =>
          new ComfyWorkflow({
            path: file.path,
            modified: file.lastModified,
            size: file.size
          })
      )
  })

  const loadWorkflowFiles = wrapWithErrorHandlingAsync(async () => {
    await userFileStore.syncFiles('workflows')
  })

  const workflows = computed(() => [
    ...persistedWorkflows.value,
    ...temporaryWorkflows.value
  ])

  const bookmarkedWorkflows = computed(() =>
    workflows.value.filter((workflow) => workflow.isBookmarked)
  )
  const modifiedWorkflows = computed(() =>
    workflows.value.filter((workflow) => workflow.isModified)
  )
  const workflowLookup = computed(() =>
    Object.fromEntries(
      workflows.value.map((workflow) => [workflow.path, workflow])
    )
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
      workflow.path
    ])
  )
  // Open workflows tree is flat.
  const openWorkflowsTree = computed(() =>
    buildTree(openWorkflows.value, (workflow: ComfyWorkflow) => [workflow.key])
  )

  return {
    activeWorkflow,
    openWorkflows,
    openWorkflowsTree,
    openWorkflow,
    closeWorkflow,
    createTemporary,

    workflows,
    bookmarkedWorkflows,
    modifiedWorkflows,
    workflowLookup,
    workflowsTree,
    bookmarkedWorkflowsTree,
    buildWorkflowTree,
    loadNextOpenedWorkflow,
    loadPreviousOpenedWorkflow,
    loadWorkflowFiles
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
