import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import GpuSessionChip from './GpuSessionChip.vue'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/workspace/api/workspaceApi'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const deployment = {
  deployment_id: 'dep-1',
  release_id: 'r-1',
  status: 'ready',
  can_start: false,
  created_at: '2026-10-01T00:00:00Z'
}

function renderOn(pickedDeployment: Record<string, unknown>) {
  const pageFetch = window.fetch
  Object.assign(useDeploymentPickStore(), { pickedDeployment })
  render(GpuSessionChip, { global: { plugins: [i18n] } })
  return { pageFetch }
}

describe('GpuSessionChip', () => {
  it('renders nothing and leaves fetch alone when the deployment carries no editor_gpu', () => {
    const { pageFetch } = renderOn(deployment)

    expect(screen.queryByRole('switch', { name: 'GPU' })).toBeNull()
    expect(window.fetch).toBe(pageFetch)
  })

  it('shows the toggle as the deployment entry sets it', () => {
    const withEditorGpu = {
      ...deployment,
      editor_gpu: true,
      can_change_editor_gpu: true
    }
    renderOn(withEditorGpu)

    expect(screen.getByRole('switch', { name: 'GPU' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
    expect(
      screen.getByRole('button', { name: 'GPU options' })
    ).toBeInTheDocument()
  })

  it.for([
    { name: 'false', canChange: false, disabled: true },
    { name: 'left out', canChange: undefined, disabled: true },
    { name: 'true', canChange: true, disabled: false }
  ])(
    'with can_change_editor_gpu $name the toggle is disabled: $disabled',
    ({ canChange, disabled }) => {
      const entry = {
        ...deployment,
        editor_gpu: false,
        can_change_editor_gpu: canChange
      }
      renderOn(entry)

      expect(screen.getByRole('switch', { name: 'GPU' })).toHaveProperty(
        'disabled',
        disabled
      )
    }
  )

  it('enables the toggle again when saving fails, as a save timeout does', async () => {
    let fail: (reason: Error) => void = () => {}
    vi.mocked(workspaceApi.setEditorGpu).mockReturnValue(
      new Promise((_resolve, reject) => {
        fail = reject
      })
    )
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    renderOn({ ...deployment, editor_gpu: false, can_change_editor_gpu: true })
    const toggle = screen.getByRole('switch', { name: 'GPU' })

    await userEvent.setup().click(toggle)
    await vi.waitFor(() => expect(toggle).toHaveProperty('disabled', true))

    fail(new Error('timeout of 15000ms exceeded'))

    await vi.waitFor(() => expect(toggle).toHaveProperty('disabled', false))
    expect(workspaceApi.setEditorGpu).toHaveBeenCalledWith('ws-1', 'dep-1', {
      on: true
    })
  })

  it('disables the options while a change to the close setting is saving', async () => {
    vi.mocked(workspaceApi.setEditorGpu).mockReturnValue(new Promise(() => {}))
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    renderOn({ ...deployment, editor_gpu: false, can_change_editor_gpu: true })
    const user = userEvent.setup()

    await user.click(screen.getByRole('button', { name: 'GPU options' }))
    const closeOption = await screen.findByRole('menuitemcheckbox', {
      name: 'Turn off when I close the editor'
    })
    await user.click(closeOption)

    await vi.waitFor(() =>
      expect(closeOption).toHaveAttribute('aria-disabled', 'true')
    )
    expect(
      screen.getByRole('menuitem', { name: 'Turn off when idle' })
    ).toHaveAttribute('aria-disabled', 'true')
    expect(workspaceApi.setEditorGpu).toHaveBeenCalledOnce()
  })
})
