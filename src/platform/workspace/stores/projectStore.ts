import type {
  ListProjectsResponse,
  Project,
  ProjectQuota
} from '@comfyorg/ingest-types'
import { reportError } from '@comfyorg/telemetry/reportError'
import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'
import { setSelectedProjectId } from '@/platform/remote/ingest/projectRequestContext'
import { projectsApi } from '@/platform/workspace/api/projectsApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

const LAST_PROJECT_PREFIX = 'Comfy.Project.LastId.'

type ProjectStoreState =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | {
      phase: 'ready'
      projects: Project[]
      projectsInUse: boolean
      quota: ProjectQuota
      selectedId: string | null
    }
  | { phase: 'unavailable' }
  | { phase: 'error' }

export function listedProjects(projects: Project[]): Project[] {
  return [...projects].sort(
    (a, b) => Number(b.is_default) - Number(a.is_default)
  )
}

function readLastProjectId(workspaceId: string): string | null {
  try {
    return localStorage.getItem(LAST_PROJECT_PREFIX + workspaceId)
  } catch {
    return null
  }
}

function writeLastProjectId(
  workspaceId: string,
  projectId: string | null
): void {
  try {
    const key = LAST_PROJECT_PREFIX + workspaceId
    if (projectId) localStorage.setItem(key, projectId)
    else localStorage.removeItem(key)
  } catch {
    return
  }
}

function pickSelectedId(
  projects: Project[],
  preferredId: string | null
): string | null {
  if (preferredId && projects.some((project) => project.id === preferredId)) {
    return preferredId
  }
  if (projects.length === 0) return null
  return projects.find((project) => project.is_default)?.id ?? projects[0].id
}

export const useProjectStore = defineStore('project', () => {
  const { flags } = useFeatureFlags()
  const workspaceStore = useTeamWorkspaceStore()
  const state = ref<ProjectStoreState>({ phase: 'idle' })
  let loadGeneration = 0

  const projects = computed(() =>
    state.value.phase === 'ready' ? state.value.projects : []
  )
  const selectedId = computed(() =>
    state.value.phase === 'ready' ? state.value.selectedId : null
  )
  const selectedProject = computed(
    () =>
      projects.value.find((project) => project.id === selectedId.value) ?? null
  )
  const projectsInUse = computed(
    () => state.value.phase === 'ready' && state.value.projectsInUse
  )
  const canCreate = computed(() => {
    if (state.value.phase !== 'ready') return false
    return state.value.quota.can_create
  })
  const isLoading = computed(() => state.value.phase === 'loading')
  const hasLoadError = computed(() => state.value.phase === 'error')
  const showSwitcher = computed(
    () =>
      flags.projectsEnabled &&
      state.value.phase === 'ready' &&
      state.value.projectsInUse
  )

  function clear(): void {
    loadGeneration++
    state.value = { phase: 'idle' }
    setSelectedProjectId(null)
  }

  function receiveList(
    response: ListProjectsResponse,
    preferredId?: string | null
  ): void {
    const nextProjects = listedProjects(response.projects)
    const workspaceId = workspaceStore.workspaceId
    const nextId = pickSelectedId(
      nextProjects,
      preferredId ?? (workspaceId ? readLastProjectId(workspaceId) : null)
    )
    state.value = {
      phase: 'ready',
      projects: nextProjects,
      projectsInUse: response.projects_in_use,
      quota: response.quota,
      selectedId: nextId
    }
    setSelectedProjectId(nextId)
    if (workspaceId) writeLastProjectId(workspaceId, nextId)
  }

  function selectProject(projectId: string): void {
    if (state.value.phase !== 'ready' || state.value.selectedId === projectId) {
      return
    }
    if (!state.value.projects.some((project) => project.id === projectId)) {
      return
    }
    state.value = { ...state.value, selectedId: projectId }
    setSelectedProjectId(projectId)
    const workspaceId = workspaceStore.workspaceId
    if (workspaceId) writeLastProjectId(workspaceId, projectId)
  }

  async function load(): Promise<void> {
    if (!flags.projectsEnabled) {
      clear()
      return
    }
    const generation = ++loadGeneration
    state.value = { phase: 'loading' }
    try {
      const response = await projectsApi.list()
      if (generation !== loadGeneration) return
      receiveList(response)
    } catch (error: unknown) {
      if (generation !== loadGeneration) return
      if (
        error instanceof WorkspaceApiError &&
        error.code === 'projects_not_available'
      ) {
        state.value = { phase: 'unavailable' }
        setSelectedProjectId(null)
        return
      }
      reportError(error, {
        errorType: 'error_loading_projects',
        surface: 'workspace'
      })
      state.value = { phase: 'error' }
    }
  }

  function receiveLoading(): void {
    state.value = { phase: 'loading' }
  }

  function receiveError(): void {
    state.value = { phase: 'error' }
  }

  watch(
    () => [flags.projectsEnabled, workspaceStore.workspaceId] as const,
    ([enabled]) => {
      if (!enabled) {
        clear()
        return
      }
      void load()
    }
  )

  return {
    projects,
    selectedProject,
    selectedId,
    projectsInUse,
    canCreate,
    isLoading,
    hasLoadError,
    showSwitcher,
    receiveList,
    receiveLoading,
    receiveError,
    selectProject,
    load
  }
})
