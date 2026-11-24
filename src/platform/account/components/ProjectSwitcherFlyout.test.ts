import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { getActivePinia } from 'pinia'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import enMessages from '@/locales/en/main.json'
import {
  listProjectsAtLimit,
  listProjectsByRole
} from '@/platform/workspace/api/__fixtures__/projects'
import { useProjectStore } from '@/platform/workspace/stores/projectStore'

import ProjectSwitcherFlyout from '@/platform/account/components/ProjectSwitcherFlyout.vue'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/workspace/api/projectsApi'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

type ProjectList = typeof listProjectsByRole.owner

function mountFlyout() {
  return render(ProjectSwitcherFlyout, {
    global: {
      plugins: [getActivePinia()!, i18n],
      stubs: { WorkspaceProfilePic: true }
    }
  })
}

function renderFlyout(list: ProjectList) {
  vi.mocked(useFeatureFlags().flags).projectsEnabled = true
  useProjectStore().receiveList(list)
  return mountFlyout()
}

describe('ProjectSwitcherFlyout', () => {
  it('lists the default project first', () => {
    const owner = listProjectsByRole.owner
    renderFlyout({
      ...owner,
      projects: [owner.projects[1], owner.projects[0]]
    })
    const rows = screen.getAllByTestId('project-switcher-row')
    expect(rows[0]).toHaveTextContent('Default')
    expect(rows[1]).toHaveTextContent('Studio')
  })

  it('shows why create is unavailable without a disabled control', () => {
    renderFlyout(listProjectsByRole.runner)
    expect(
      screen.queryByRole('button', { name: /create project/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', {
        name: /only owners and workspace admins can create projects/i
      })
    ).not.toBeInTheDocument()
    expect(
      screen.getByTestId('project-switcher-create-refusal')
    ).toHaveTextContent('Only owners and workspace admins can create projects.')
  })

  it.for([
    {
      name: 'loading',
      seed: () => useProjectStore().receiveLoading()
    },
    {
      name: 'load failed',
      seed: () => useProjectStore().receiveError()
    }
  ])('hides the cannot-create line while $name', ({ seed }) => {
    vi.mocked(useFeatureFlags().flags).projectsEnabled = true
    seed()
    mountFlyout()
    expect(
      screen.queryByTestId('project-switcher-create-refusal')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('project-switcher-footer-divider')
    ).not.toBeInTheDocument()
  })

  it('offers create when quota.can_create is true', () => {
    renderFlyout(listProjectsByRole.owner)
    expect(screen.getByTestId('project-switcher-create')).toBeEnabled()
    expect(
      screen.queryByTestId('project-switcher-create-refusal')
    ).not.toBeInTheDocument()
  })

  it('selects a project from the list', async () => {
    const user = userEvent.setup()
    renderFlyout(listProjectsAtLimit)
    await user.click(screen.getByRole('button', { name: /Studio/ }))
    expect(useProjectStore().selectedId).toBe('proj-studio')
  })
})
