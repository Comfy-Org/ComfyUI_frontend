import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
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
  storeToRefs: vi.fn((store: Record<string, unknown>) => store)
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
  default: defineComponent({
    name: 'CurrentUserPopoverLegacyMock',
    emits: ['close'],
    setup(_, { emit }) {
      return () =>
        h('div', [
          'Popover Content',
          h(
            'button',
            {
              'data-testid': 'close-popover',
              onClick: () => emit('close')
            },
            'Close'
          )
        ])
    }
  })
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

  function renderComponent() {
    const user = userEvent.setup()
    const i18n = createI18n({
      legacy: false,
      locale: 'en',
      messages: { en: enMessages }
    })

    const result = render(CurrentUserButton, {
      global: {
        plugins: [i18n],
        stubs: {
          Popover: defineComponent({
            setup(_, { slots, expose }) {
              const shown = ref(false)
              expose({
                toggle: () => {
                  shown.value = !shown.value
                },
                hide: () => {
                  shown.value = false
                }
              })
              return () => (shown.value ? h('div', slots.default?.()) : null)
            }
          })
        }
      }
    })

    return { user, ...result }
  }

  it('renders correctly when user is logged in', () => {
    renderComponent()
    expect(
      screen.getByRole('button', { name: 'Current user' })
    ).toBeInTheDocument()
  })

  it('toggles popover on button click', async () => {
    const { user } = renderComponent()

    expect(screen.queryByText('Popover Content')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Current user' }))

    expect(screen.getByText('Popover Content')).toBeInTheDocument()
  })

  it('hides popover when closePopover is called', async () => {
    const { user } = renderComponent()

    await user.click(screen.getByRole('button', { name: 'Current user' }))
    expect(screen.getByText('Popover Content')).toBeInTheDocument()

    await user.click(screen.getByTestId('close-popover'))

    expect(screen.queryByText('Popover Content')).not.toBeInTheDocument()
  })

  it('shows UserAvatar in personal workspace', () => {
    mockIsCloud.value = true
    mockFeatureFlags.teamWorkspacesEnabled = true
    mockTeamWorkspaceStore.initState.value = 'ready'
    mockTeamWorkspaceStore.isInPersonalWorkspace.value = true

    renderComponent()
    expect(screen.getByText('Avatar')).toBeInTheDocument()
    expect(screen.queryByText('WorkspaceProfilePic')).not.toBeInTheDocument()
  })

  it('shows WorkspaceProfilePic in team workspace', () => {
    mockIsCloud.value = true
    mockFeatureFlags.teamWorkspacesEnabled = true
    mockTeamWorkspaceStore.initState.value = 'ready'
    mockTeamWorkspaceStore.isInPersonalWorkspace.value = false
    mockTeamWorkspaceStore.workspaceName.value = 'My Team'

    renderComponent()
    expect(screen.getByText('WorkspaceProfilePic')).toBeInTheDocument()
    expect(screen.queryByText('Avatar')).not.toBeInTheDocument()
  })
})
