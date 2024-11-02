import { defineStore } from 'pinia'
import { computed, markRaw, ref, toRaw } from 'vue'
import { buildTree } from '@/utils/treeUtil'
import { api } from '@/scripts/api'
import { UserFile } from './userFileStore'
import { ChangeTracker } from '@/scripts/changeTracker'
import { ComfyWorkflowJSON } from '@/types/comfyWorkflow'
import { appendJsonExt } from '@/utils/formatUtil'
import { defaultGraph, defaultGraphJSON } from '@/scripts/defaultGraph'
import { syncEntities } from '@/utils/syncUtil'

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

  /**
   * @deprecated Use filename instead
   */
  get name() {
    return this.filename
  }

  get key() {
    return this.path.substring('workflows/'.length)
  }

  get activeState(): ComfyWorkflowJSON | null {
    return this.changeTracker?.activeState ?? null
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
      this.originalWorkflow = JSON.parse(this.originalContent!)
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

  async rename(newName: string) {
    const newPath = this.directory + '/' + appendJsonExt(newName)
    await super.rename(newPath)
    return this
  }
}

export const useWorkflowStore = defineStore('workflow', () => {
  /**
   * The active workflow currently being edited.
   */
  const activeWorkflow = ref<ComfyWorkflow | null>(null)
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
    if (isActive(workflow)) {
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
