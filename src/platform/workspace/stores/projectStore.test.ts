import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'
import {
  PROJECT_ID_HEADER,
  projectIdHeaders,
  setSelectedProjectId
} from '@/platform/remote/ingest/projectRequestContext'
import { listProjectsByRole } from '@/platform/workspace/api/__fixtures__/projects'
import { projectsApi } from '@/platform/workspace/api/projectsApi'
import {
  listedProjects,
  useProjectStore
} from '@/platform/workspace/stores/projectStore'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/workspace/api/projectsApi'))
vi.mock(import('@comfyorg/telemetry/reportError'))

const defaultOnly = {
  projects: [listProjectsByRole.owner.projects[0]],
  projects_in_use: false,
  quota: { active: 0, max_active: 25, can_create: true }
}

describe('listedProjects', () => {
  it('puts the default project first', () => {
    const studio = listProjectsByRole.owner.projects[1]
    const fallback = listProjectsByRole.owner.projects[0]
    expect(
      listedProjects([studio, fallback]).map((project) => project.id)
    ).toEqual(['proj-default', 'proj-studio'])
  })
})

describe('useProjectStore', () => {
  beforeEach(() => {
    setSelectedProjectId(null)
    vi.mocked(useFeatureFlags().flags).projectsEnabled = true
  })

  it('selects the default project and sends its id on requests', async () => {
    vi.mocked(projectsApi.list).mockResolvedValue(listProjectsByRole.owner)
    const store = useProjectStore()
    await store.load()

    expect(store.selectedId).toBe('proj-default')
    expect(store.projects.map((project) => project.id)).toEqual([
      'proj-default',
      'proj-studio'
    ])
    expect(projectIdHeaders()).toEqual({
      [PROJECT_ID_HEADER]: 'proj-default'
    })
  })

  it('keeps the switcher hidden until a second project exists', async () => {
    vi.mocked(projectsApi.list).mockResolvedValue(defaultOnly)
    const store = useProjectStore()
    await store.load()

    expect(store.projectsInUse).toBe(false)
    expect(store.showSwitcher).toBe(false)
    expect(store.selectedId).toBe('proj-default')
  })

  it('shows the switcher when the workspace has a second project', async () => {
    vi.mocked(projectsApi.list).mockResolvedValue(listProjectsByRole.owner)
    const store = useProjectStore()
    await store.load()

    expect(store.showSwitcher).toBe(true)
  })

  it('hides the switcher when the client gate is off', async () => {
    vi.mocked(useFeatureFlags().flags).projectsEnabled = false
    vi.mocked(projectsApi.list).mockResolvedValue(listProjectsByRole.owner)
    const store = useProjectStore()
    await store.load()

    expect(store.showSwitcher).toBe(false)
    expect(projectsApi.list).not.toHaveBeenCalled()
    expect(projectIdHeaders()).toEqual({})
  })

  it('hides the switcher when projects are not available', async () => {
    vi.mocked(projectsApi.list).mockRejectedValue(
      new WorkspaceApiError(
        'projects_not_available',
        403,
        'projects_not_available'
      )
    )
    const store = useProjectStore()
    await store.load()

    expect(store.showSwitcher).toBe(false)
    expect(projectIdHeaders()).toEqual({})
  })

  it('points later requests at the project the caller selected', async () => {
    vi.mocked(projectsApi.list).mockResolvedValue(listProjectsByRole.owner)
    const store = useProjectStore()
    await store.load()
    store.selectProject('proj-studio')

    expect(store.selectedId).toBe('proj-studio')
    expect(projectIdHeaders()).toEqual({
      [PROJECT_ID_HEADER]: 'proj-studio'
    })
  })

  it('reads quota.can_create as served', async () => {
    vi.mocked(projectsApi.list).mockResolvedValue(listProjectsByRole.runner)
    const store = useProjectStore()
    await store.load()
    expect(store.canCreate).toBe(false)

    vi.mocked(projectsApi.list).mockResolvedValue(listProjectsByRole.owner)
    await store.load()
    expect(store.canCreate).toBe(true)
  })
})
