import { defineStore } from 'pinia'
import { computed, readonly, ref } from 'vue'
import type { Ref } from 'vue'

import { isAppWorkflow } from '@/platform/workflow/management/appWorkflow'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

export interface AppCatalogEntry {
  path: string
  title: string
  lastModified: number
}

const SYNC_INTERVAL_MS = 30_000

const useAppCatalogStore = defineStore('superComfyAppCatalog', () => {
  const workflowStore = useWorkflowStore()
  const loading = ref(false)
  const lastSyncedAt = ref(Number.NEGATIVE_INFINITY)

  const apps = computed(() =>
    workflowStore.persistedWorkflows
      .filter(isAppWorkflow)
      .map((workflow) => ({
        path: workflow.path,
        title: workflow.filename,
        lastModified: workflow.lastModified
      }))
      .sort((a, b) => a.title.localeCompare(b.title))
  )

  async function refresh() {
    loading.value = true
    try {
      await workflowStore.loadWorkflows()
      if (Date.now() - lastSyncedAt.value < SYNC_INTERVAL_MS) return
      lastSyncedAt.value = Date.now()
      await workflowStore.syncWorkflows()
    } finally {
      loading.value = false
    }
  }

  return { apps, loading: readonly(loading), refresh }
})

export function useAppCatalog(): {
  apps: Readonly<Ref<AppCatalogEntry[]>>
  loading: Readonly<Ref<boolean>>
  refresh(): Promise<void>
} {
  const store = useAppCatalogStore()
  return {
    apps: computed(() => store.apps),
    loading: computed(() => store.loading),
    refresh: () => store.refresh()
  }
}
