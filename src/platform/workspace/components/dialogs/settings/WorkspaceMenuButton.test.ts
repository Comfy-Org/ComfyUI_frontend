import { useDialogService } from '@/services/dialogService'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

import WorkspaceMenuButton from './WorkspaceMenuButton.vue'

const ownerConfig = {
  showEditWorkspaceMenuItem: true,
  workspaceMenuAction: 'delete' as const,
  workspaceMenuDisabledTooltip:
    'workspacePanel.menu.deleteWorkspaceDisabledTooltip'
}
const memberConfig = {
  showEditWorkspaceMenuItem: false,
  workspaceMenuAction: null,
  workspaceMenuDisabledTooltip: null
}
const personalConfig = {
  showEditWorkspaceMenuItem: true,
  workspaceMenuAction: null,
  workspaceMenuDisabledTooltip: null
}

const mockUiConfig = ref<Record<string, unknown>>(ownerConfig)
const mockCanLeaveWorkspace = ref(false)
const mockCanManageSubscription = ref(true)

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

vi.mock(import('@/services/dialogService'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

async function renderComponent() {
  render(WorkspaceMenuButton, {
    global: {
      plugins: [i18n],
      directives: { tooltip: {} }
    }
  })
  await userEvent.click(screen.getByRole('button', { name: 'More Options' }))
}

describe('WorkspaceMenuButton', () => {
  beforeEach(() => {
    const workspaceUI = vi.mocked(useWorkspaceUI())
    const defaultPermissions = workspaceUI.permissions.value
    workspaceUI.permissions = computed(() => ({
      ...defaultPermissions,
      canLeaveWorkspace: mockCanLeaveWorkspace.value,
      canManageSubscription: mockCanManageSubscription.value
    }))
    const defaultUiConfig = workspaceUI.uiConfig.value
    workspaceUI.uiConfig = computed(() => ({
      ...defaultUiConfig,
      ...mockUiConfig.value,
      workspaceMenuAction:
        mockUiConfig.value.workspaceMenuAction === 'delete' ? 'delete' : null
    }))
    mockUiConfig.value = ownerConfig
    mockCanLeaveWorkspace.value = false
    mockCanManageSubscription.value = true
    Object.assign(useTeamWorkspaceStore(), { isWorkspaceSubscribed: false })
  })

  it('lets a member leave and offers no destructive workspace actions', async () => {
    mockUiConfig.value = memberConfig
    mockCanLeaveWorkspace.value = true
    mockCanManageSubscription.value = false
    await renderComponent()

    const leave = screen.getByRole('menuitem', { name: 'Leave Workspace' })
    expect(leave).toBeEnabled()
    expect(
      screen.queryByRole('menuitem', { name: 'Delete Workspace' })
    ).not.toBeInTheDocument()
  })

  it('lets an additional workspace owner leave and delete', async () => {
    const user = userEvent.setup()
    mockCanLeaveWorkspace.value = true
    await renderComponent()

    expect(
      screen.getByRole('menuitem', { name: 'Leave Workspace' })
    ).toBeEnabled()
    expect(
      screen.getByRole('menuitem', { name: 'Delete Workspace' })
    ).toBeEnabled()

    await user.click(screen.getByRole('menuitem', { name: 'Delete Workspace' }))
    expect(useDialogService().showDeleteWorkspaceDialog).toHaveBeenCalledOnce()
  })

  it('does not expose Delete in a personal workspace', async () => {
    mockUiConfig.value = personalConfig
    await renderComponent()

    expect(
      screen.queryByRole('menuitem', { name: 'Delete Workspace' })
    ).not.toBeInTheDocument()
  })

  it('disables Delete while the additional workspace is subscribed', async () => {
    Object.assign(useTeamWorkspaceStore(), { isWorkspaceSubscribed: true })
    await renderComponent()

    expect(
      screen.getByRole('menuitem', { name: 'Delete Workspace' })
    ).toHaveAttribute('aria-disabled', 'true')
  })

  it('hides Leave when workspace permission is withheld', async () => {
    await renderComponent()

    expect(
      screen.queryByRole('menuitem', { name: 'Leave Workspace' })
    ).not.toBeInTheDocument()
  })

  it('opens the leave dialog when an owner clicks Leave', async () => {
    const user = userEvent.setup()
    mockCanLeaveWorkspace.value = true
    await renderComponent()

    await user.click(screen.getByRole('menuitem', { name: 'Leave Workspace' }))
    expect(useDialogService().showLeaveWorkspaceDialog).toHaveBeenCalledOnce()
  })

  it('rechecks permission before opening the leave dialog', async () => {
    mockCanLeaveWorkspace.value = true
    await renderComponent()

    const leave = screen.getByRole('menuitem', { name: 'Leave Workspace' })
    mockCanLeaveWorkspace.value = false
    leave.click()

    expect(useDialogService().showLeaveWorkspaceDialog).not.toHaveBeenCalled()
  })

  it('rechecks owner permission before opening the delete dialog', async () => {
    await renderComponent()

    const deleteWorkspace = screen.getByRole('menuitem', {
      name: 'Delete Workspace'
    })
    mockCanManageSubscription.value = false
    deleteWorkspace.click()

    expect(useDialogService().showDeleteWorkspaceDialog).not.toHaveBeenCalled()
  })

  it('rechecks the subscription lock before opening the delete dialog', async () => {
    await renderComponent()

    const deleteWorkspace = screen.getByRole('menuitem', {
      name: 'Delete Workspace'
    })
    Object.assign(useTeamWorkspaceStore(), { isWorkspaceSubscribed: true })
    deleteWorkspace.click()

    expect(useDialogService().showDeleteWorkspaceDialog).not.toHaveBeenCalled()
  })
})
