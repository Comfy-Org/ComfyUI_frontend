import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
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
  workspaceMenuAction: 'leave' as const,
  workspaceMenuDisabledTooltip: null
}

const mockUiConfig = ref<Record<string, unknown>>(ownerConfig)
const mockIsWorkspaceSubscribed = ref(false)

const mockShowLeaveWorkspaceDialog = vi.fn()
const mockShowDeleteWorkspaceDialog = vi.fn()
const mockShowEditWorkspaceDialog = vi.fn()

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({ uiConfig: mockUiConfig })
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
    mockIsWorkspaceSubscribed.value = false
  })

  it('lets a member leave and offers no destructive workspace actions', () => {
    mockUiConfig.value = memberConfig
    renderComponent()

    const leave = screen.getByRole('button', { name: 'Leave Workspace' })
    expect(leave).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Delete Workspace' })
    ).not.toBeInTheDocument()
  })

  it('lets an owner leave', () => {
    renderComponent()

    expect(
      screen.getByRole('button', { name: 'Leave Workspace' })
    ).toBeEnabled()
    expect(
      screen.getByRole('button', { name: 'Delete Workspace' })
    ).toBeInTheDocument()
  })

  it('opens the leave dialog when an owner clicks Leave', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByRole('button', { name: 'Leave Workspace' }))
    expect(mockShowLeaveWorkspaceDialog).toHaveBeenCalledOnce()
  })
})
