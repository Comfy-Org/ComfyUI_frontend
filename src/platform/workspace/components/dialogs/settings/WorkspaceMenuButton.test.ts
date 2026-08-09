import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

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
const mockIsWorkspaceSubscribed = ref(false)

const mockShowLeaveWorkspaceDialog = vi.fn()
const mockShowDeleteWorkspaceDialog = vi.fn()
const mockShowEditWorkspaceDialog = vi.fn()

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: computed(() => ({
      canLeaveWorkspace: mockCanLeaveWorkspace.value,
      canManageSubscription: mockCanManageSubscription.value
    })),
    uiConfig: mockUiConfig
  })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    isWorkspaceSubscribed: mockIsWorkspaceSubscribed
  })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showLeaveWorkspaceDialog: mockShowLeaveWorkspaceDialog,
    showDeleteWorkspaceDialog: mockShowDeleteWorkspaceDialog,
    showEditWorkspaceDialog: mockShowEditWorkspaceDialog
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const DropdownMenuStub = {
  props: ['entries'],
  template:
    '<div data-testid="menu"><button v-for="entry in entries" :key="entry.label" type="button" :disabled="entry.disabled" @click="entry.command?.()">{{ entry.label }}</button></div>'
}

function renderComponent() {
  return render(WorkspaceMenuButton, {
    global: {
      plugins: [i18n],
      directives: { tooltip: {} },
      stubs: { DropdownMenu: DropdownMenuStub, Button: true }
    }
  })
}

describe('WorkspaceMenuButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUiConfig.value = ownerConfig
    mockCanLeaveWorkspace.value = false
    mockCanManageSubscription.value = true
    mockIsWorkspaceSubscribed.value = false
  })

  it('lets a member leave and offers no destructive workspace actions', () => {
    mockUiConfig.value = memberConfig
    mockCanLeaveWorkspace.value = true
    mockCanManageSubscription.value = false
    renderComponent()

    const leave = screen.getByRole('button', { name: 'Leave Workspace' })
    expect(leave).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Delete Workspace' })
    ).not.toBeInTheDocument()
  })

  it('lets an additional workspace owner leave and delete', async () => {
    const user = userEvent.setup()
    mockCanLeaveWorkspace.value = true
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Leave Workspace' })
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Delete Workspace' })
    ).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Delete Workspace' }))
    expect(mockShowDeleteWorkspaceDialog).toHaveBeenCalledOnce()
  })

  it('does not expose Delete in a personal workspace', () => {
    mockUiConfig.value = personalConfig
    renderComponent()

    expect(
      screen.queryByRole('button', { name: 'Delete Workspace' })
    ).not.toBeInTheDocument()
  })

  it('disables Delete while the additional workspace is subscribed', () => {
    mockIsWorkspaceSubscribed.value = true
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Delete Workspace' })
    ).toBeDisabled()
  })

  it('hides Leave when workspace permission is withheld', () => {
    renderComponent()

    expect(
      screen.queryByRole('button', { name: 'Leave Workspace' })
    ).not.toBeInTheDocument()
  })

  it('opens the leave dialog when an owner clicks Leave', async () => {
    const user = userEvent.setup()
    mockCanLeaveWorkspace.value = true
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Leave Workspace' }))
    expect(mockShowLeaveWorkspaceDialog).toHaveBeenCalledOnce()
  })

  it('rechecks permission before opening the leave dialog', () => {
    mockCanLeaveWorkspace.value = true
    renderComponent()

    const leave = screen.getByRole('button', { name: 'Leave Workspace' })
    mockCanLeaveWorkspace.value = false
    leave.click()

    expect(mockShowLeaveWorkspaceDialog).not.toHaveBeenCalled()
  })

  it('rechecks owner permission before opening the delete dialog', () => {
    renderComponent()

    const deleteWorkspace = screen.getByRole('button', {
      name: 'Delete Workspace'
    })
    mockCanManageSubscription.value = false
    deleteWorkspace.click()

    expect(mockShowDeleteWorkspaceDialog).not.toHaveBeenCalled()
  })

  it('rechecks the subscription lock before opening the delete dialog', () => {
    renderComponent()

    const deleteWorkspace = screen.getByRole('button', {
      name: 'Delete Workspace'
    })
    mockIsWorkspaceSubscribed.value = true
    deleteWorkspace.click()

    expect(mockShowDeleteWorkspaceDialog).not.toHaveBeenCalled()
  })
})
