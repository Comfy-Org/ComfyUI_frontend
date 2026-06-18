import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'

import WorkspaceMenuButton from './WorkspaceMenuButton.vue'

const CREATOR = {
  id: 'creator',
  name: 'Creator',
  email: 'creator@test.com',
  joinDate: new Date('2026-01-01T00:00:00Z'),
  role: 'owner' as const
}
const LATER_OWNER = {
  id: 'owner-2',
  name: 'Owner Two',
  email: 'owner2@test.com',
  joinDate: new Date('2026-02-01T00:00:00Z'),
  role: 'owner' as const
}
const LATER_MEMBER = {
  id: 'member-2',
  name: 'Member Two',
  email: 'member2@test.com',
  joinDate: new Date('2026-02-01T00:00:00Z'),
  role: 'member' as const
}

const ownerConfig = {
  showEditWorkspaceMenuItem: true,
  workspaceMenuAction: 'delete' as const,
  workspaceMenuDisabledTooltip:
    'workspacePanel.menu.deleteWorkspaceDisabledTooltip'
}
const memberConfig = {
  showEditWorkspaceMenuItem: false,
  workspaceMenuAction: 'leave' as const,
  workspaceMenuDisabledTooltip: null
}

const mockUiConfig = ref<Record<string, unknown>>(ownerConfig)
const mockMembers = ref<WorkspaceMember[]>([CREATOR, LATER_OWNER])
const mockUserEmail = ref<string | null>('owner2@test.com')
const mockIsWorkspaceSubscribed = ref(false)

const mockShowLeaveWorkspaceDialog = vi.fn()
const mockShowDeleteWorkspaceDialog = vi.fn()
const mockShowEditWorkspaceDialog = vi.fn()

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({ uiConfig: mockUiConfig })
}))

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    isWorkspaceSubscribed: mockIsWorkspaceSubscribed,
    members: mockMembers
  })
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({ userEmail: mockUserEmail })
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
    mockMembers.value = [CREATOR, LATER_OWNER]
    mockUserEmail.value = 'owner2@test.com'
    mockIsWorkspaceSubscribed.value = false
  })

  it('lets a member leave and offers no destructive workspace actions', () => {
    mockUiConfig.value = memberConfig
    mockMembers.value = [CREATOR, LATER_MEMBER]
    mockUserEmail.value = 'member2@test.com'
    renderComponent()

    const leave = screen.getByRole('button', { name: 'Leave Workspace' })
    expect(leave).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Delete Workspace' })
    ).not.toBeInTheDocument()
  })

  it('lets a non-creator owner leave', () => {
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Leave Workspace' })
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Delete Workspace' })
    ).toBeInTheDocument()
  })

  it('shows the creator a disabled Leave option', () => {
    mockUserEmail.value = 'creator@test.com'
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Leave Workspace' })
    ).toBeDisabled()
  })

  it('opens the leave dialog when a non-creator owner clicks Leave', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Leave Workspace' }))
    expect(mockShowLeaveWorkspaceDialog).toHaveBeenCalledOnce()
  })

  it('does not open the leave dialog for the creator', async () => {
    const user = userEvent.setup()
    mockUserEmail.value = 'creator@test.com'
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Leave Workspace' }))
    expect(mockShowLeaveWorkspaceDialog).not.toHaveBeenCalled()
  })
})
