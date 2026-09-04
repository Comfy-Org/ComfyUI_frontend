/* eslint-disable testing-library/no-container */
/* eslint-disable testing-library/no-node-access */
import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'

import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import TeamWorkspacesDialogContent from './TeamWorkspacesDialogContent.vue'

const flushPromises = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0))

const mockCloseDialog = vi.fn()
const mockToastAdd = vi.fn()
const mockSwitchWorkspace = vi.fn()

let pinia: ReturnType<typeof createTestingPinia>
let workspaceStore: ReturnType<typeof useTeamWorkspaceStore>

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({
    add: mockToastAdd
  })
}))

vi.mock('@/stores/dialogStore', () => ({
  useDialogStore: () => ({
    closeDialog: mockCloseDialog
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceSwitch', () => ({
  useWorkspaceSwitch: () => ({
    switchWorkspace: mockSwitchWorkspace
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceTierLabel', () => ({
  useWorkspaceTierLabel: () => ({
    getTierLabel: (w: { subscriptionTier: string | null }) =>
      w.subscriptionTier === 'PRO' ? 'Pro' : null
  })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

const ButtonStub = {
  name: 'Button',
  template:
    '<button :disabled="disabled" :data-loading="loading" @click="$emit(\'click\')"><slot /></button>',
  props: ['disabled', 'loading', 'variant', 'size']
}

function mountComponent(props: Record<string, unknown> = {}) {
  const user = userEvent.setup()
  const { container } = render(TeamWorkspacesDialogContent, {
    props,
    global: {
      plugins: [pinia, i18n],
      stubs: {
        Button: ButtonStub,
        WorkspaceProfilePic: true
      }
    }
  })
  return { container, user }
}

function findCreateButton(container: Element): HTMLButtonElement {
  const buttons = container.querySelectorAll('button')
  return Array.from(buttons).find(
    (btn) => !btn.closest('header') && !btn.closest('li')
  ) as HTMLButtonElement
}

function createTeamWorkspace({
  id,
  name,
  role,
  isSubscribed = false,
  subscriptionTier = null
}: {
  id: string
  name: string
  role: 'owner' | 'member'
  isSubscribed?: boolean
  subscriptionTier?: 'PRO' | null
}) {
  return {
    id,
    name,
    type: 'team' as const,
    role,
    created_at: '2025-01-01',
    joined_at: '2025-01-01',
    isSubscribed,
    subscriptionPlan: null,
    subscriptionTier,
    members: [],
    pendingInvites: []
  }
}

function setOwnedWorkspaces() {
  workspaceStore.workspaces = [
    createTeamWorkspace({
      id: 'ws-1',
      name: 'Team Alpha',
      role: 'owner',
      isSubscribed: true,
      subscriptionTier: 'PRO'
    }),
    createTeamWorkspace({
      id: 'ws-2',
      name: 'Team Beta',
      role: 'member'
    })
  ]
}

describe('TeamWorkspacesDialogContent', () => {
  beforeEach(() => {
    pinia = createTestingPinia({ createSpy: vi.fn, stubActions: false })
    workspaceStore = useTeamWorkspaceStore(pinia)
    workspaceStore.workspaces = []
  })

  describe('workspace listing', () => {
    it('displays only owned workspaces', () => {
      setOwnedWorkspaces()
      const { container } = mountComponent()
      const items = container.querySelectorAll('li')
      expect(items).toHaveLength(1)
      expect(container.textContent).toContain('Team Alpha')
      expect(container.textContent).not.toContain('Team Beta')
    })

    it('shows tier label for subscribed workspaces', () => {
      setOwnedWorkspaces()
      const { container } = mountComponent()
      expect(container.textContent).toContain('Pro')
    })

    it('hides workspace list section when no owned workspaces', () => {
      const { container } = mountComponent()
      expect(container.querySelectorAll('li')).toHaveLength(0)
    })

    it('shows create-only subtitle when no owned workspaces', () => {
      const { container } = mountComponent()
      const subtitle = container.querySelector('header p')
      expect(subtitle?.textContent).toBe(
        'teamWorkspacesDialog.subtitleNoWorkspaces'
      )
    })

    it('shows switch-or-create subtitle when owned workspaces exist', () => {
      setOwnedWorkspaces()
      const { container } = mountComponent()
      const subtitle = container.querySelector('header p')
      expect(subtitle?.textContent).toBe('teamWorkspacesDialog.subtitle')
    })
  })

  describe('workspace switching', () => {
    it('calls switchWorkspace with workspace id and closes dialog on success', async () => {
      mockSwitchWorkspace.mockResolvedValue(true)
      setOwnedWorkspaces()
      const { container, user } = mountComponent()

      const switchButton = container.querySelector('li button')!
      await user.click(switchButton)
      await flushPromises()

      expect(mockSwitchWorkspace).toHaveBeenCalledWith('ws-1')
      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'team-workspaces'
      })
    })

    it('shows error toast and keeps dialog open when switch fails', async () => {
      mockSwitchWorkspace.mockRejectedValue(new Error('Network error'))
      setOwnedWorkspaces()
      const { container, user } = mountComponent()

      const switchButton = container.querySelector('li button')!
      await user.click(switchButton)
      await flushPromises()

      expect(mockCloseDialog).not.toHaveBeenCalled()
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Network error'
        })
      )
    })
  })

  describe('name validation', () => {
    it('disables create button for empty name', () => {
      const { container } = mountComponent()
      expect(findCreateButton(container)).toBeDisabled()
    })

    it('enables create button for valid name', async () => {
      const { container, user } = mountComponent()
      const input = container.querySelector(
        '#workspace-name-input'
      ) as HTMLInputElement
      await user.clear(input)
      await user.type(input, 'My Team')
      await nextTick()

      expect(findCreateButton(container)).not.toBeDisabled()
    })

    it('disables create button for name with special characters', async () => {
      const { container, user } = mountComponent()
      const input = container.querySelector(
        '#workspace-name-input'
      ) as HTMLInputElement
      await user.clear(input)
      await user.type(input, '!@#$%')
      await nextTick()

      expect(findCreateButton(container)).toBeDisabled()
    })

    it('disables create button for name exceeding 50 characters', async () => {
      const { container, user } = mountComponent()
      const input = container.querySelector(
        '#workspace-name-input'
      ) as HTMLInputElement
      await user.clear(input)
      await user.type(input, 'a'.repeat(51))
      await nextTick()

      expect(findCreateButton(container)).toBeDisabled()
    })
  })

  describe('workspace creation', () => {
    async function typeAndCreate(
      container: Element,
      user: ReturnType<typeof userEvent.setup>,
      name: string
    ) {
      const input = container.querySelector(
        '#workspace-name-input'
      ) as HTMLInputElement
      await user.clear(input)
      await user.type(input, name)
      await user.click(findCreateButton(container))
      await flushPromises()
    }

    it('calls createWorkspace and onConfirm on success', async () => {
      vi.mocked(workspaceStore.createWorkspace).mockResolvedValue(
        createTeamWorkspace({
          id: 'new-ws',
          name: 'New Team',
          role: 'owner'
        })
      )
      const onConfirm = vi.fn()
      const { container, user } = mountComponent({ onConfirm })

      await typeAndCreate(container, user, 'New Team')

      expect(workspaceStore.createWorkspace).toHaveBeenCalledWith('New Team')
      expect(onConfirm).toHaveBeenCalledWith('New Team')
      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'team-workspaces'
      })
    })

    it('shows error toast when creation fails', async () => {
      vi.mocked(workspaceStore.createWorkspace).mockRejectedValue(
        new Error('Limit reached')
      )
      const { container, user } = mountComponent()

      await typeAndCreate(container, user, 'New Team')

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Limit reached'
        })
      )
      expect(mockCloseDialog).not.toHaveBeenCalled()
    })

    it('shows separate toast when onConfirm fails but still closes dialog', async () => {
      vi.mocked(workspaceStore.createWorkspace).mockResolvedValue(
        createTeamWorkspace({
          id: 'new-ws',
          name: 'New Team',
          role: 'owner'
        })
      )
      const onConfirm = vi.fn().mockRejectedValue(new Error('Setup failed'))
      const { container, user } = mountComponent({ onConfirm })

      await typeAndCreate(container, user, 'New Team')

      expect(workspaceStore.createWorkspace).toHaveBeenCalledWith('New Team')
      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Setup failed'
        })
      )
      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'team-workspaces'
      })
    })

    it('does not call onConfirm when createWorkspace fails', async () => {
      vi.mocked(workspaceStore.createWorkspace).mockRejectedValue(
        new Error('Limit reached')
      )
      const onConfirm = vi.fn()
      const { container, user } = mountComponent({ onConfirm })

      await typeAndCreate(container, user, 'New Team')

      expect(onConfirm).not.toHaveBeenCalled()
    })

    it('does not call createWorkspace when name is invalid', async () => {
      const { container, user } = mountComponent()
      await user.click(findCreateButton(container))
      await nextTick()

      expect(workspaceStore.createWorkspace).not.toHaveBeenCalled()
    })

    it('resets loading state after createWorkspace fails', async () => {
      vi.mocked(workspaceStore.createWorkspace).mockRejectedValue(
        new Error('Limit reached')
      )
      const { container, user } = mountComponent()

      await typeAndCreate(container, user, 'New Team')

      expect(findCreateButton(container).dataset.loading).toBe('false')
    })

    it('resets loading state after onConfirm fails', async () => {
      vi.mocked(workspaceStore.createWorkspace).mockResolvedValue(
        createTeamWorkspace({
          id: 'new-ws',
          name: 'New Team',
          role: 'owner'
        })
      )
      const onConfirm = vi.fn().mockRejectedValue(new Error('Setup failed'))
      const { container, user } = mountComponent({ onConfirm })

      await typeAndCreate(container, user, 'New Team')

      expect(findCreateButton(container).dataset.loading).toBe('false')
    })
  })

  describe('close button', () => {
    it('closes dialog on close button click', async () => {
      const { container, user } = mountComponent()
      const closeBtn = container.querySelector('header button')!
      await user.click(closeBtn)

      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'team-workspaces'
      })
    })
  })
})
