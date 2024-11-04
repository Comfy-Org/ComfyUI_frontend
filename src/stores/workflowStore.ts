import { defineStore } from 'pinia'
import { computed, markRaw, ref } from 'vue'
import { buildTree } from '@/utils/treeUtil'
import { api } from '@/scripts/api'
import { UserFile } from './userFileStore'
import { ChangeTracker } from '@/scripts/changeTracker'
import { ComfyWorkflowJSON } from '@/types/comfyWorkflow'
import { appendJsonExt } from '@/utils/formatUtil'
import { defaultGraphJSON } from '@/scripts/defaultGraph'
import { syncEntities } from '@/utils/syncUtil'

export class ComfyWorkflow extends UserFile {
  changeTracker: ChangeTracker | null = null

  /**
   * @param options The path, modified, and size of the workflow.
   * Note: path is the full path, including the 'workflows/' prefix.
   */
  constructor(options: { path: string; modified: number; size: number }) {
    super(options.path, options.modified, options.size)
  }

  get key() {
    return this.path.substring('workflows/'.length)
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
    const changeTracker = markRaw(
      new ChangeTracker(
        this,
        /* initialState= */ JSON.parse(this.originalContent)
      )
    )
    this.changeTracker = changeTracker
    return this as LoadedComfyWorkflow
  }

  unload(): void {
    this.changeTracker = null
    super.unload()
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

  async rename(newName: string) {
    const newPath = this.directory + '/' + appendJsonExt(newName)
    await super.rename(newPath)
    return this
  }
}

export interface LoadedComfyWorkflow extends ComfyWorkflow {
  isLoaded: true
  changeTracker: ChangeTracker
  initialState: ComfyWorkflowJSON
  activeState: ComfyWorkflowJSON
}

export const useWorkflowStore = defineStore('workflow', () => {
  /**
   * The active workflow currently being edited.
   */
  const activeWorkflow = ref<LoadedComfyWorkflow | null>(null)
  const isActive = (workflow: ComfyWorkflow) =>
    activeWorkflow.value?.path === workflow.path
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
   * The temporary workflows that are not saved to remote storage.
   */
  const temporaryWorkflows = ref<Set<ComfyWorkflow>>(new Set())

  /**
   * Set the workflow as the active workflow.
   * @param workflow The workflow to open.
   */
  const openWorkflow = async (workflow: ComfyWorkflow) => {
    if (isActive(workflow)) return

    if (!openWorkflowPaths.value.includes(workflow.path)) {
      openWorkflowPaths.value.push(workflow.path)
    }
    activeWorkflow.value = await workflow.load()
  }

  const createTemporary = (path?: string, workflowData?: ComfyWorkflowJSON) => {
    const fullPath =
      'workflows/' + (path ?? 'temporary_' + Date.now() + '.json')
    const workflow = new ComfyWorkflow({
      path: fullPath,
      modified: Date.now(),
      size: 0
    })

    workflow.originalContent = workflow.content = workflowData
      ? JSON.stringify(workflowData)
      : defaultGraphJSON

    temporaryWorkflows.value.add(workflow)
    return workflow
  }

  const closeWorkflow = async (workflow: ComfyWorkflow) => {
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

  const persistedWorkflowByPath = ref<Record<string, ComfyWorkflow>>({})
  const persistedWorkflows = computed(() =>
    Object.values(persistedWorkflowByPath.value)
  )
  const syncWorkflows = async (dir: string = '') => {
    await syncEntities(
      dir ? 'workflows/' + dir : 'workflows',
      persistedWorkflowByPath.value,
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
      }
    )
  }

  const workflows = computed(() => [
    ...persistedWorkflows.value,
    ...temporaryWorkflows.value
  ])

  const bookmarkStore = useWorkflowBookmarkStore()
  const bookmarkedWorkflows = computed(() =>
    workflows.value.filter((workflow) =>
      bookmarkStore.isBookmarked(workflow.path)
    )
  )
  const modifiedWorkflows = computed(() =>
    workflows.value.filter((workflow) => workflow.isModified)
  )
  const workflowLookup = computed<Record<string, ComfyWorkflow>>(
    () =>
      Object.fromEntries(
        workflows.value.map((workflow) => [workflow.path, workflow])
      ) as Record<string, ComfyWorkflow>
  )
  const getWorkflowByPath = (path: string): ComfyWorkflow =>
    workflowLookup.value[path]

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
    buildTree(bookmarkedWorkflows.value, (workflow) => [workflow.key])
  )
  // Open workflows tree is flat.
  const openWorkflowsTree = computed(() =>
    buildTree(openWorkflows.value, (workflow) => [workflow.key])
  )

  const renameWorkflow = async (workflow: ComfyWorkflow, newName: string) => {
    const oldPath = workflow.path
    await workflow.rename(newName)
    if (bookmarkStore.isBookmarked(oldPath)) {
      bookmarkStore.setBookmarked(oldPath, false)
      bookmarkStore.setBookmarked(workflow.path, true)
    }
  }

  const deleteWorkflow = async (workflow: ComfyWorkflow) => {
    if (isOpen(workflow)) {
      await closeWorkflow(workflow)
    }

    await workflow.delete()

    if (bookmarkStore.isBookmarked(workflow.path)) {
      bookmarkStore.setBookmarked(workflow.path, false)
    }

    delete persistedWorkflowByPath.value[workflow.path]
  }

  return {
    activeWorkflow,
    isActive,
    openWorkflows,
    openWorkflowsTree,
    openedWorkflowIndexShift,
    openWorkflow,
    isOpen,
    closeWorkflow,
    createTemporary,
    renameWorkflow,
    deleteWorkflow,

    workflows,
    bookmarkedWorkflows,
    modifiedWorkflows,
    getWorkflowByPath,
    workflowsTree,
    bookmarkedWorkflowsTree,
    buildWorkflowTree,
    syncWorkflows
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
