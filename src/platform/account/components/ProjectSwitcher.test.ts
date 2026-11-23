import { render, screen } from '@testing-library/vue'
import { getActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { WorkspaceApiError } from '@/platform/remote/ingest/ingestApiError'
import { listProjectsByRole } from '@/platform/workspace/api/__fixtures__/projects'
import { projectsApi } from '@/platform/workspace/api/projectsApi'
import { useProjectStore } from '@/platform/workspace/stores/projectStore'

import ProjectSwitcher from '@/platform/account/components/ProjectSwitcher.vue'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/workspace/api/projectsApi'))
vi.mock(import('@comfyorg/telemetry/reportError'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const defaultOnly = {
  projects: [listProjectsByRole.owner.projects[0]],
  projects_in_use: false,
  quota: { active: 0, max_active: 25, can_create: true }
}

function renderSwitcher() {
  return render(ProjectSwitcher, {
    global: {
      plugins: [getActivePinia()!, i18n],
      stubs: { WorkspaceProfilePic: true }
    }
  })
}

describe('ProjectSwitcher show rule', () => {
  beforeEach(() => {
    vi.mocked(useFeatureFlags().flags).projectsEnabled = true
  })

  it.for([
    {
      name: 'the client gate is off',
      setup: async () => {
        vi.mocked(useFeatureFlags().flags).projectsEnabled = false
        vi.mocked(projectsApi.list).mockResolvedValue(listProjectsByRole.owner)
        await useProjectStore().load()
      }
    },
    {
      name: 'only the default project exists',
      setup: async () => {
        vi.mocked(projectsApi.list).mockResolvedValue(defaultOnly)
        await useProjectStore().load()
      }
    },
    {
      name: 'projects are not available',
      setup: async () => {
        vi.mocked(projectsApi.list).mockRejectedValue(
          new WorkspaceApiError(
            'projects_not_available',
            403,
            'projects_not_available'
          )
        )
        await useProjectStore().load()
      }
    }
  ])('hides the switcher when $name', async ({ setup }) => {
    await setup()
    renderSwitcher()
    expect(
      screen.queryByTestId('project-switcher-trigger')
    ).not.toBeInTheDocument()
  })

  it('shows the switcher when the workspace has a second project', async () => {
    vi.mocked(projectsApi.list).mockResolvedValue(listProjectsByRole.owner)
    await useProjectStore().load()
    renderSwitcher()
    const trigger = screen.getByTestId('project-switcher-trigger')
    expect(trigger).toBeInTheDocument()
    expect(trigger).toHaveAccessibleName(/Default/)
    expect(trigger).toHaveAccessibleName(/Switch project/)
  })
})
