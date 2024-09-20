import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { ComfyWorkflow } from '@/scripts/workflows'
import { buildTree } from '@/utils/treeUtil'
import { api } from '@/scripts/api'

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
  const bookmarkedWorkflowsTree = computed(() =>
    buildWorkflowTree(bookmarkedWorkflows.value)
  )
  const openWorkflowsTree = computed(() =>
    buildWorkflowTree(openWorkflows.value as ComfyWorkflow[])
  )

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
    buildWorkflowTree
  }
})

export const useWorkflowBookmarkStore = defineStore('workflowBookmark', () => {
  const bookmarks = ref<Set<string>>(new Set())
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

  watch(bookmarks, () => {
    saveBookmarks()
  })

  const setBookmarked = (path: string, value: boolean) => {
    if (value) {
      bookmarks.value.add(path)
    } else {
      bookmarks.value.delete(path)
    }
  }

  const toggleBookmarked = (path: string) => {
    setBookmarked(path, !bookmarks.value.has(path))
  }

  return {
    bookmarks,
    loadBookmarks,
    saveBookmarks,
    setBookmarked,
    toggleBookmarked
  }
})
