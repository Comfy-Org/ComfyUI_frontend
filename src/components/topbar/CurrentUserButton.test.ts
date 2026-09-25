import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import CurrentUserButton from './CurrentUserButton.vue'
vi.mock(import('firebase/auth'))

const mockIsCloud = vi.hoisted(() => ({ value: false }))

vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return mockIsCloud.value
  }
}))

vi.mock(import('@/composables/auth/useCurrentUser'))

// Mock the WorkspaceProfilePic component
vi.mock<unknown>(
  import('@/platform/workspace/components/WorkspaceProfilePic.vue'),
  () => ({
    default: {
      name: 'WorkspaceProfilePicMock',
      render() {
        return h('div', 'WorkspaceProfilePic')
      }
    }
  })
)

const CurrentUserPopoverWorkspaceStub = defineComponent({
  name: 'CurrentUserPopoverWorkspace',
  props: {
    accountActionsOnly: Boolean
  },
  setup(props, { expose }) {
    expose({ refreshBalance: vi.fn() })
    return () =>
      h('div', [
        h('span', 'Workspace Popover Content'),
        props.accountActionsOnly ? h('span', 'Account Actions Only') : ''
      ])
  }
})

const PopoverStub = defineComponent({
  name: 'Popover',
  emits: ['show', 'hide'],
  setup(_, { emit, expose, slots }) {
    const open = ref(false)
    expose({
      toggle: () => {
        open.value = !open.value
        emit(open.value ? 'show' : 'hide')
      },
      hide: () => {
        open.value = false
        emit('hide')
      }
    })
    return () => (open.value ? slots.default?.() : null)
  }
})

// Mock the CurrentUserPopoverLegacy component
vi.mock(import('./CurrentUserPopoverLegacy.vue'), () => ({
  default: defineComponent({
    name: 'CurrentUserPopoverLegacyMock',
    emits: ['close'],
    setup(_, { emit }) {
      return () =>
        h('div', [
          h('span', 'Popover Content'),
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
    useCurrentUser().isLoggedIn = computed(() => true)
    useCurrentUser().userPhotoUrl = computed(
      () => 'https://example.com/avatar.jpg'
    )
    useCurrentUser().userDisplayName = computed(() => 'Test User')
    useCurrentUser().userEmail = computed(() => 'test@example.com')
    Object.assign(useTeamWorkspaceStore(), { workspaceName: '' })
    useTeamWorkspaceStore().initState = 'uninitialized'
    Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: false })
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
          Popover: PopoverStub,
          CurrentUserPopoverWorkspace: CurrentUserPopoverWorkspaceStub
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

  it.for(['loading', 'error'] as const)(
    'shows account actions while Cloud workspace initialization is %s',
    async (initState) => {
      mockIsCloud.value = true
      useTeamWorkspaceStore().initState = initState
      const { user } = renderComponent()

      await user.click(screen.getByRole('button', { name: 'Current user' }))

      expect(
        await screen.findByText('Workspace Popover Content')
      ).toBeInTheDocument()
      expect(screen.getByText('Account Actions Only')).toBeInTheDocument()
    }
  )

  it('hides popover when closePopover is called', async () => {
    const { user } = renderComponent()

    await user.click(screen.getByRole('button', { name: 'Current user' }))
    expect(screen.getByText('Popover Content')).toBeInTheDocument()

    await user.click(screen.getByTestId('close-popover'))

    expect(screen.queryByText('Popover Content')).not.toBeInTheDocument()
  })

  it('shows UserAvatar in personal workspace', () => {
    mockIsCloud.value = true
    useTeamWorkspaceStore().initState = 'ready'
    Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: true })

    renderComponent()
    expect(screen.getByRole('img', { name: 'User Avatar' })).toHaveAttribute(
      'src',
      'https://example.com/avatar.jpg'
    )
    expect(screen.queryByText('WorkspaceProfilePic')).not.toBeInTheDocument()
  })

  it('shows WorkspaceProfilePic in team workspace', () => {
    mockIsCloud.value = true
    useTeamWorkspaceStore().initState = 'ready'
    Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: false })
    Object.assign(useTeamWorkspaceStore(), { workspaceName: 'My Team' })

    renderComponent()
    expect(screen.getByText('WorkspaceProfilePic')).toBeInTheDocument()
    expect(screen.queryByText('Avatar')).not.toBeInTheDocument()
  })

  it('shows WorkspaceProfilePic for an active local team workspace', () => {
    useTeamWorkspaceStore().initState = 'ready'
    Object.assign(useTeamWorkspaceStore(), { isInPersonalWorkspace: false })
    Object.assign(useTeamWorkspaceStore(), { workspaceName: 'My Team' })

    renderComponent()

    expect(screen.getByText('WorkspaceProfilePic')).toBeInTheDocument()
    expect(screen.queryByText('Avatar')).not.toBeInTheDocument()
  })

  it('shows workspace actions after local workspace initialization', async () => {
    useTeamWorkspaceStore().initState = 'ready'
    const { user } = renderComponent()

    await user.click(screen.getByRole('button', { name: 'Current user' }))

    expect(
      await screen.findByText('Workspace Popover Content')
    ).toBeInTheDocument()
    expect(screen.queryByText('Popover Content')).not.toBeInTheDocument()
  })
})
