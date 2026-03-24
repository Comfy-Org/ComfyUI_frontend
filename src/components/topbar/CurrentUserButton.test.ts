import type { VueWrapper } from '@vue/test-utils'
import { mount } from '@vue/test-utils'
import Button from '@/components/ui/button/Button.vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }

import CurrentUserButton from './CurrentUserButton.vue'

const mockFeatureFlags = vi.hoisted(() => ({
  teamWorkspacesEnabled: false
}))

const mockTeamWorkspaceStore = vi.hoisted(() => ({
  workspaceName: { value: '' },
  initState: { value: 'idle' },
  isInPersonalWorkspace: { value: false }
}))

const mockIsCloud = vi.hoisted(() => ({ value: false }))

// Mock all firebase modules
vi.mock('firebase/app', () => ({
  initializeApp: vi.fn(),
  getApp: vi.fn()
}))

vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(),
  setPersistence: vi.fn(),
  browserLocalPersistence: {},
  onAuthStateChanged: vi.fn(),
  signInWithEmailAndPassword: vi.fn(),
  signOut: vi.fn()
}))

// Mock pinia
vi.mock('pinia', () => ({
  storeToRefs: vi.fn((store) => store)
}))

// Mock the useFeatureFlags composable
vi.mock('@/composables/useFeatureFlags', () => ({
  useFeatureFlags: vi.fn(() => ({
    flags: mockFeatureFlags
  }))
}))

// Mock the useTeamWorkspaceStore
vi.mock('@/platform/workspace/stores/teamWorkspaceStore', () => ({
  useTeamWorkspaceStore: vi.fn(() => mockTeamWorkspaceStore)
}))

vi.mock('@/platform/distribution/types', () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

// Mock the useCurrentUser composable
vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: vi.fn(() => ({
    isLoggedIn: true,
    userPhotoUrl: 'https://example.com/avatar.jpg',
    userDisplayName: 'Test User',
    userEmail: 'test@example.com'
  }))
}))

// Mock the UserAvatar component
vi.mock('@/components/common/UserAvatar.vue', () => ({
  default: {
    name: 'UserAvatarMock',
    render() {
      return h('div', 'Avatar')
    }
  }
}))

// Mock the WorkspaceProfilePic component
vi.mock('@/platform/workspace/components/WorkspaceProfilePic.vue', () => ({
  default: {
    name: 'WorkspaceProfilePicMock',
    render() {
      return h('div', 'WorkspaceProfilePic')
    }
  }
}))

// Mock the CurrentUserPopoverLegacy component
vi.mock('./CurrentUserPopoverLegacy.vue', () => ({
  default: {
    name: 'CurrentUserPopoverLegacyMock',
    render() {
      return h('div', 'Popover Content')
    },
    emits: ['close']
  }
}))

describe('CurrentUserButton', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFeatureFlags.teamWorkspacesEnabled = false
    mockTeamWorkspaceStore.workspaceName.value = ''
    mockTeamWorkspaceStore.initState.value = 'idle'
    mockTeamWorkspaceStore.isInPersonalWorkspace.value = false
    mockIsCloud.value = false
  })

  const mountComponent = (options?: { stubButton?: boolean }): VueWrapper => {
    const { stubButton = true } = options ?? {}
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })

    return mount(CurrentUserButton, {
      global: {
        plugins: [i18n],
        stubs: {
          // Use shallow mount for popover to make testing easier
          Popover: {
            template: '<div><slot></slot></div>',
            methods: {
              toggle: vi.fn(),
              hide: vi.fn()
            }
          },
          ...(stubButton ? { Button: true } : {})
        }
      }
    })
  }

  it('renders correctly when user is logged in', () => {
    const wrapper = mountComponent()
    expect(wrapper.findComponent(Button).exists()).toBe(true)
  })

  it('toggles popover on button click', async () => {
    const wrapper = mountComponent()
    const popoverToggleSpy = vi.fn()

    // Override the ref with a mock implementation
    // @ts-expect-error - accessing internal Vue component vm
    wrapper.vm.popover = { toggle: popoverToggleSpy }

    await wrapper.findComponent(Button).trigger('click')
    expect(popoverToggleSpy).toHaveBeenCalled()
  })

  it('hides popover when closePopover is called', async () => {
    const wrapper = mountComponent()

    // Replace the popover.hide method with a spy
    const popoverHideSpy = vi.fn()
    // @ts-expect-error - accessing internal Vue component vm
    wrapper.vm.popover = { hide: popoverHideSpy }

    // Directly call the closePopover method through the component instance
    // @ts-expect-error - accessing internal Vue component vm
    wrapper.vm.closePopover()

    // Verify that popover.hide was called
    expect(popoverHideSpy).toHaveBeenCalled()
  })

  it('shows UserAvatar in personal workspace', () => {
    mockIsCloud.value = true
    mockFeatureFlags.teamWorkspacesEnabled = true
    mockTeamWorkspaceStore.initState.value = 'ready'
    mockTeamWorkspaceStore.isInPersonalWorkspace.value = true

    const wrapper = mountComponent({ stubButton: false })
    expect(wrapper.html()).toContain('Avatar')
    expect(wrapper.html()).not.toContain('WorkspaceProfilePic')
  })

  it('shows WorkspaceProfilePic in team workspace', () => {
    mockIsCloud.value = true
    mockFeatureFlags.teamWorkspacesEnabled = true
    mockTeamWorkspaceStore.initState.value = 'ready'
    mockTeamWorkspaceStore.isInPersonalWorkspace.value = false
    mockTeamWorkspaceStore.workspaceName.value = 'My Team'

    const wrapper = mountComponent({ stubButton: false })
    expect(wrapper.html()).toContain('WorkspaceProfilePic')
    expect(wrapper.html()).not.toContain('Avatar')
  })
})
