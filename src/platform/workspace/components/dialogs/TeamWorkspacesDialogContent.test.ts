import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { nextTick } from 'vue'

import TeamWorkspacesDialogContent from './TeamWorkspacesDialogContent.vue'

const mockCloseDialog = vi.fn()
const mockToastAdd = vi.fn()
const mockSwitchWorkspace = vi.fn()
const mockCreateWorkspace = vi.fn()
const mockSharedWorkspaces = vi.hoisted(() => ({
  value: [] as Array<{
    id: string
    name: string
    role: string
    isSubscribed: boolean
    subscriptionPlan: string | null
    subscriptionTier: string | null
  }>
}))

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

vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: () => ({
    sharedWorkspaces: mockSharedWorkspaces,
    createWorkspace: mockCreateWorkspace
  })
}))

vi.mock('pinia', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as object),
    storeToRefs: (store: Record<string, unknown>) => store
  }
})

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
    '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
  props: ['disabled', 'loading', 'variant', 'size']
}

function mountComponent(props: Record<string, unknown> = {}) {
  return mount(TeamWorkspacesDialogContent, {
    props,
    shallow: true,
    global: {
      plugins: [i18n],
      stubs: {
        Button: ButtonStub,
        WorkspaceProfilePic: true
      }
    }
  })
}

function findCreateButton(wrapper: ReturnType<typeof mountComponent>) {
  return wrapper.findComponent(ButtonStub)
}

function setOwnedWorkspaces() {
  mockSharedWorkspaces.value = [
    {
      id: 'ws-1',
      name: 'Team Alpha',
      role: 'owner',
      isSubscribed: true,
      subscriptionPlan: null,
      subscriptionTier: 'PRO'
    },
    {
      id: 'ws-2',
      name: 'Team Beta',
      role: 'member',
      isSubscribed: false,
      subscriptionPlan: null,
      subscriptionTier: null
    }
  ]
}

describe('TeamWorkspacesDialogContent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSharedWorkspaces.value = []
  })

  describe('workspace listing', () => {
    it('displays only owned workspaces', () => {
      setOwnedWorkspaces()
      const wrapper = mountComponent()
      const items = wrapper.findAll('li')
      expect(items).toHaveLength(1)
      expect(wrapper.text()).toContain('Team Alpha')
      expect(wrapper.text()).not.toContain('Team Beta')
    })

    it('shows tier label for subscribed workspaces', () => {
      setOwnedWorkspaces()
      const wrapper = mountComponent()
      expect(wrapper.text()).toContain('Pro')
    })

    it('hides workspace list section when no owned workspaces', () => {
      const wrapper = mountComponent()
      expect(wrapper.findAll('li')).toHaveLength(0)
    })

    it('shows create-only subtitle when no owned workspaces', () => {
      const wrapper = mountComponent()
      const subtitle = wrapper.find('header p')
      expect(subtitle.text()).toBe('teamWorkspacesDialog.subtitleNoWorkspaces')
    })

    it('shows switch-or-create subtitle when owned workspaces exist', () => {
      setOwnedWorkspaces()
      const wrapper = mountComponent()
      const subtitle = wrapper.find('header p')
      expect(subtitle.text()).toBe('teamWorkspacesDialog.subtitle')
    })
  })

  describe('workspace switching', () => {
    it('calls switchWorkspace with workspace id and closes dialog on success', async () => {
      mockSwitchWorkspace.mockResolvedValue(true)
      setOwnedWorkspaces()
      const wrapper = mountComponent()

      const switchButton = wrapper.find('li button')
      await switchButton.trigger('click')
      await flushPromises()

      expect(mockSwitchWorkspace).toHaveBeenCalledWith('ws-1')
      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'team-workspaces'
      })
    })

    it('shows error toast and keeps dialog open when switch fails', async () => {
      mockSwitchWorkspace.mockRejectedValue(new Error('Network error'))
      setOwnedWorkspaces()
      const wrapper = mountComponent()

      const switchButton = wrapper.find('li button')
      await switchButton.trigger('click')
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
      const wrapper = mountComponent()
      expect(findCreateButton(wrapper).props('disabled')).toBe(true)
    })

    it('enables create button for valid name', async () => {
      const wrapper = mountComponent()
      const input = wrapper.find('#workspace-name-input')
      await input.setValue('My Team')
      await nextTick()

      expect(findCreateButton(wrapper).props('disabled')).toBe(false)
    })

    it('disables create button for name with special characters', async () => {
      const wrapper = mountComponent()
      const input = wrapper.find('#workspace-name-input')
      await input.setValue('!@#$%')
      await nextTick()

      expect(findCreateButton(wrapper).props('disabled')).toBe(true)
    })

    it('disables create button for name exceeding 50 characters', async () => {
      const wrapper = mountComponent()
      const input = wrapper.find('#workspace-name-input')
      await input.setValue('a'.repeat(51))
      await nextTick()

      expect(findCreateButton(wrapper).props('disabled')).toBe(true)
    })
  })

  describe('workspace creation', () => {
    async function typeAndCreate(
      wrapper: ReturnType<typeof mountComponent>,
      name: string
    ) {
      await wrapper.find('#workspace-name-input').setValue(name)
      await nextTick()
      findCreateButton(wrapper).vm.$emit('click')
      await flushPromises()
    }

    it('calls createWorkspace and onConfirm on success', async () => {
      mockCreateWorkspace.mockResolvedValue({ id: 'new-ws' })
      const onConfirm = vi.fn()
      const wrapper = mountComponent({ onConfirm })

      await typeAndCreate(wrapper, 'New Team')

      expect(mockCreateWorkspace).toHaveBeenCalledWith('New Team')
      expect(onConfirm).toHaveBeenCalledWith('New Team')
      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'team-workspaces'
      })
    })

    it('shows error toast when creation fails', async () => {
      mockCreateWorkspace.mockRejectedValue(new Error('Limit reached'))
      const wrapper = mountComponent()

      await typeAndCreate(wrapper, 'New Team')

      expect(mockToastAdd).toHaveBeenCalledWith(
        expect.objectContaining({
          severity: 'error',
          detail: 'Limit reached'
        })
      )
      expect(mockCloseDialog).not.toHaveBeenCalled()
    })

    it('shows separate toast when onConfirm fails but still closes dialog', async () => {
      mockCreateWorkspace.mockResolvedValue({ id: 'new-ws' })
      const onConfirm = vi.fn().mockRejectedValue(new Error('Setup failed'))
      const wrapper = mountComponent({ onConfirm })

      await typeAndCreate(wrapper, 'New Team')

      expect(mockCreateWorkspace).toHaveBeenCalledWith('New Team')
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
      mockCreateWorkspace.mockRejectedValue(new Error('Limit reached'))
      const onConfirm = vi.fn()
      const wrapper = mountComponent({ onConfirm })

      await typeAndCreate(wrapper, 'New Team')

      expect(onConfirm).not.toHaveBeenCalled()
    })

    it('does not call createWorkspace when name is invalid', async () => {
      const wrapper = mountComponent()
      findCreateButton(wrapper).vm.$emit('click')
      await nextTick()

      expect(mockCreateWorkspace).not.toHaveBeenCalled()
    })
  })

  describe('close button', () => {
    it('closes dialog on close button click', async () => {
      const wrapper = mountComponent()
      const closeBtn = wrapper.find('header button')
      await closeBtn.trigger('click')

      expect(mockCloseDialog).toHaveBeenCalledWith({
        key: 'team-workspaces'
      })
    })
  })
})
