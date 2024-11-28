import { defineStore } from 'pinia'
import { computed, markRaw, ref } from 'vue'
import { api } from '@/scripts/api'
import { UserFile } from './userFileStore'
import { ChangeTracker } from '@/scripts/changeTracker'
import { ComfyWorkflowJSON } from '@/types/comfyWorkflow'
import { getPathDetails } from '@/utils/formatUtil'
import { defaultGraphJSON } from '@/scripts/defaultGraph'
import { syncEntities } from '@/utils/syncUtil'

export class ComfyWorkflow extends UserFile {
  static readonly basePath = 'workflows/'

  /**
   * The change tracker for the workflow. Non-reactive raw object.
   */
  changeTracker: ChangeTracker | null = null
  /**
   * Whether the workflow has been modified comparing to the initial state.
   */
  private _isModified: boolean = false

  /**
   * @param options The path, modified, and size of the workflow.
   * Note: path is the full path, including the 'workflows/' prefix.
   */
  constructor(options: { path: string; modified: number; size: number }) {
    super(options.path, options.modified, options.size)
  }

  get key() {
    return this.path.substring(ComfyWorkflow.basePath.length)
  }

  get activeState(): ComfyWorkflowJSON | null {
    return this.changeTracker?.activeState ?? null
  }

  get initialState(): ComfyWorkflowJSON | null {
    return this.changeTracker?.initialState ?? null
  }

  get isLoaded(): boolean {
    return this.changeTracker !== null
  }

  get isModified(): boolean {
    return this._isModified
  }

  set isModified(value: boolean) {
    this._isModified = value
  }

  /**
   * Load the workflow content from remote storage. Directly returns the loaded
   * workflow if the content is already loaded.
   *
   * @param force Whether to force loading the content even if it is already loaded.
   * @returns this
   */
  async load({
    force = false
  }: { force?: boolean } = {}): Promise<LoadedComfyWorkflow> {
    await super.load({ force })
    if (!force && this.isLoaded) return this as LoadedComfyWorkflow

    if (!this.originalContent) {
      throw new Error('[ASSERT] Workflow content should be loaded')
    }

    // Note: originalContent is populated by super.load()
    console.debug('load and start tracking of workflow', this.path)
    this.changeTracker = markRaw(
      new ChangeTracker(
        this,
        /* initialState= */ JSON.parse(this.originalContent)
      )
    )
    return this as LoadedComfyWorkflow
  }

  unload(): void {
    console.debug('unload workflow', this.path)
    this.changeTracker = null
    super.unload()
  }

  async save() {
    this.content = JSON.stringify(this.activeState)
    // Force save to ensure the content is updated in remote storage incase
    // the isModified state is screwed by changeTracker.
    const ret = await super.save({ force: true })
    this.changeTracker?.reset()
    this.isModified = false
    return ret
  }

  /**
   * Save the workflow as a new file.
   * @param path The path to save the workflow to. Note: with 'workflows/' prefix.
   * @returns this
   */
  async saveAs(path: string) {
    this.content = JSON.stringify(this.activeState)
    return await super.saveAs(path)
  }
}

export interface LoadedComfyWorkflow extends ComfyWorkflow {
  isLoaded: true
  originalContent: string
  content: string
  changeTracker: ChangeTracker
  initialState: ComfyWorkflowJSON
  activeState: ComfyWorkflowJSON
}

/**
 * Exposed store interface for the workflow store.
 * Explicitly typed to avoid trigger following error:
 * error TS7056: The inferred type of this node exceeds the maximum length the
 * compiler will serialize. An explicit type annotation is needed.
 */
export interface WorkflowStore {
  activeWorkflow: LoadedComfyWorkflow | null
  isActive: (workflow: ComfyWorkflow) => boolean
  openWorkflows: LoadedComfyWorkflow[]
  openedWorkflowIndexShift: (shift: number) => LoadedComfyWorkflow | null
  openWorkflow: (workflow: ComfyWorkflow) => Promise<LoadedComfyWorkflow>
  isOpen: (workflow: ComfyWorkflow) => boolean
  isBusy: boolean
  closeWorkflow: (workflow: ComfyWorkflow) => Promise<void>
  createTemporary: (
    path?: string,
    workflowData?: ComfyWorkflowJSON
  ) => ComfyWorkflow
  renameWorkflow: (workflow: ComfyWorkflow, newPath: string) => Promise<void>
  deleteWorkflow: (workflow: ComfyWorkflow) => Promise<void>
  saveWorkflow: (workflow: ComfyWorkflow) => Promise<void>

  workflows: ComfyWorkflow[]
  bookmarkedWorkflows: ComfyWorkflow[]
  persistedWorkflows: ComfyWorkflow[]
  modifiedWorkflows: ComfyWorkflow[]
  getWorkflowByPath: (path: string) => ComfyWorkflow | null
  syncWorkflows: (dir?: string) => Promise<void>
}

export const useWorkflowStore = defineStore('workflow', () => {
  /**
   * Detach the workflow from the store. lightweight helper function.
   * @param workflow The workflow to detach.
   * @returns The index of the workflow in the openWorkflowPaths array, or -1 if the workflow was not open.
   */
  const detachWorkflow = (workflow: ComfyWorkflow) => {
    delete workflowLookup.value[workflow.path]
    const index = openWorkflowPaths.value.indexOf(workflow.path)
    if (index !== -1) {
      openWorkflowPaths.value = openWorkflowPaths.value.filter(
        (path) => path !== workflow.path
      )
    }
    return index
  }

  /**
   * Attach the workflow to the store. lightweight helper function.
   * @param workflow The workflow to attach.
   * @param openIndex The index to open the workflow at.
   */
  const attachWorkflow = (workflow: ComfyWorkflow, openIndex: number = -1) => {
    workflowLookup.value[workflow.path] = workflow

    if (openIndex !== -1) {
      openWorkflowPaths.value.splice(openIndex, 0, workflow.path)
    }
  }

  /**
   * The active workflow currently being edited.
   */
  const activeWorkflow = ref<LoadedComfyWorkflow | null>(null)
  const isActive = (workflow: ComfyWorkflow) =>
    activeWorkflow.value?.path === workflow.path
  /**
   * All workflows.
   */
  const workflowLookup = ref<Record<string, ComfyWorkflow>>({})
  const workflows = computed<ComfyWorkflow[]>(() =>
    Object.values(workflowLookup.value)
  )
  const getWorkflowByPath = (path: string): ComfyWorkflow | null =>
    workflowLookup.value[path] ?? null

  /**
   * The paths of the open workflows. It is setup as a ref to allow user
   * to reorder the workflows opened.
   */
  const openWorkflowPaths = ref<string[]>([])
  const openWorkflowPathSet = computed(() => new Set(openWorkflowPaths.value))
  const openWorkflows = computed(() =>
    openWorkflowPaths.value.map((path) => workflowLookup.value[path])
  )
  const isOpen = (workflow: ComfyWorkflow) =>
    openWorkflowPathSet.value.has(workflow.path)

  /**
   * Set the workflow as the active workflow.
   * @param workflow The workflow to open.
   */
  const openWorkflow = async (
    workflow: ComfyWorkflow
  ): Promise<LoadedComfyWorkflow> => {
    if (isActive(workflow)) return workflow as LoadedComfyWorkflow

    if (!openWorkflowPaths.value.includes(workflow.path)) {
      openWorkflowPaths.value.push(workflow.path)
    }
    const loadedWorkflow = await workflow.load()
    activeWorkflow.value = loadedWorkflow
    console.debug('[workflowStore] open workflow', workflow.path)
    return loadedWorkflow
  }

  const getUnconflictedPath = (basePath: string): string => {
    const { directory, filename, suffix } = getPathDetails(basePath)
    let counter = 2
    let newPath = basePath
    while (workflowLookup.value[newPath]) {
      newPath = `${directory}/${filename} (${counter}).${suffix}`
      counter++
    }
    return newPath
  }

  const createTemporary = (path?: string, workflowData?: ComfyWorkflowJSON) => {
    const fullPath = getUnconflictedPath(
      ComfyWorkflow.basePath + (path ?? 'Unsaved Workflow.json')
    )
    const workflow = new ComfyWorkflow({
      path: fullPath,
      modified: Date.now(),
      size: -1
    })

    workflow.originalContent = workflow.content = workflowData
      ? JSON.stringify(workflowData)
      : defaultGraphJSON

    workflowLookup.value[workflow.path] = workflow
    return workflow
  }

  const closeWorkflow = async (workflow: ComfyWorkflow) => {
    openWorkflowPaths.value = openWorkflowPaths.value.filter(
      (path) => path !== workflow.path
    )
    if (workflow.isTemporary) {
      delete workflowLookup.value[workflow.path]
    } else {
      workflow.unload()
    }
    console.debug('[workflowStore] close workflow', workflow.path)
  }

  /**
   * Get the workflow at the given index shift from the active workflow.
   * @param shift The shift to the next workflow. Positive for next, negative for previous.
   * @returns The next workflow or null if the shift is out of bounds.
   */
  const openedWorkflowIndexShift = (shift: number): ComfyWorkflow | null => {
    const index = openWorkflowPaths.value.indexOf(
      activeWorkflow.value?.path ?? ''
    )

    if (index !== -1) {
      const length = openWorkflows.value.length
      const nextIndex = (index + shift + length) % length
      const nextWorkflow = openWorkflows.value[nextIndex]
      return nextWorkflow ?? null
    }
    return null
  }

  const persistedWorkflows = computed(() =>
    Array.from(workflows.value).filter((workflow) => workflow.isPersisted)
  )
  const syncWorkflows = async (dir: string = '') => {
    await syncEntities(
      dir ? 'workflows/' + dir : 'workflows',
      workflowLookup.value,
      (file) =>
        new ComfyWorkflow({
          path: file.path,
          modified: file.modified,
          size: file.size
        }),
      (existingWorkflow, file) => {
        existingWorkflow.lastModified = file.modified
        existingWorkflow.size = file.size
        existingWorkflow.unload()
      },
      /* exclude */ (workflow) => workflow.isTemporary
    )
  }

  const bookmarkStore = useWorkflowBookmarkStore()
  const bookmarkedWorkflows = computed(() =>
    workflows.value.filter((workflow) =>
      bookmarkStore.isBookmarked(workflow.path)
    )
  )
  const modifiedWorkflows = computed(() =>
    workflows.value.filter((workflow) => workflow.isModified)
  )

  /** A filesystem operation is currently in progress (e.g. save, rename, delete) */
  const isBusy = ref<boolean>(false)

  const renameWorkflow = async (workflow: ComfyWorkflow, newPath: string) => {
    isBusy.value = true
    try {
      // Capture all needed values upfront
      const oldPath = workflow.path
      const wasBookmarked = bookmarkStore.isBookmarked(oldPath)

      const openIndex = detachWorkflow(workflow)
      // Perform the actual rename operation first
      try {
        await workflow.rename(newPath)
      } finally {
        attachWorkflow(workflow, openIndex)
      }

      // Update bookmarks
      if (wasBookmarked) {
        bookmarkStore.setBookmarked(oldPath, false)
        bookmarkStore.setBookmarked(newPath, true)
      }
    } finally {
      isBusy.value = false
    }
  }

  const deleteWorkflow = async (workflow: ComfyWorkflow) => {
    isBusy.value = true
    try {
      await workflow.delete()
      if (bookmarkStore.isBookmarked(workflow.path)) {
        bookmarkStore.setBookmarked(workflow.path, false)
      }
      delete workflowLookup.value[workflow.path]
    } finally {
      isBusy.value = false
    }
  }

  /**
   * Save a workflow.
   * @param workflow The workflow to save.
   */
  const saveWorkflow = async (workflow: ComfyWorkflow) => {
    isBusy.value = true
    try {
      // Detach the workflow and re-attach to force refresh the tree objects.
      const openIndex = detachWorkflow(workflow)
      try {
        await workflow.save()
      } finally {
        attachWorkflow(workflow, openIndex)
      }
    } finally {
      isBusy.value = false
    }
  }

  return {
    activeWorkflow,
    isActive,
    openWorkflows,
    openedWorkflowIndexShift,
    openWorkflow,
    isOpen,
    isBusy,
    closeWorkflow,
    createTemporary,
    renameWorkflow,
    deleteWorkflow,
    saveWorkflow,

    workflows,
    bookmarkedWorkflows,
    persistedWorkflows,
    modifiedWorkflows,
    getWorkflowByPath,
    syncWorkflows
  }
}) as unknown as () => WorkflowStore

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
    if (bookmarks.value.has(path) === value) return
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
