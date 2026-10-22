import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { computed, defineComponent, h, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useBillingContext } from '@/composables/billing/useBillingContext'
import type { BalanceInfo } from '@/composables/billing/types'
import CurrentUserPopoverWorkspace from '@/platform/workspace/components/CurrentUserPopoverWorkspace.vue'
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
vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))
vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))
vi.mock(
  import('@/platform/cloud/subscription/composables/useSubscriptionDialog')
)
vi.mock(import('@/platform/settings/composables/useSettingsDialog'))
vi.mock(import('@/composables/billing/useBillingDialogs'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceDialogs'))
vi.mock(import('@/platform/telemetry'))

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
  setup(props) {
    return () =>
      h('div', [
        h('span', 'Workspace Popover Content'),
        h('button', 'Account action'),
        props.accountActionsOnly ? h('span', 'Account Actions Only') : ''
      ])
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

  function renderComponent(
    workspacePopover: Component = CurrentUserPopoverWorkspaceStub
  ) {
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
          CurrentUserPopoverWorkspace: workspacePopover,
          WorkspaceSwitcherPopover: true,
          SubscribeButton: true,
          DeploymentSwitcher: true
        }
      }
    })

    return { user, ...result }
  }

  it.for(['personal', 'team'] as const)(
    'refreshes the %s balance on first opening and reopening the profile menu',
    async (workspaceType) => {
      mockIsCloud.value = true
      const balance = ref<BalanceInfo>({ amountMicros: 100, currency: 'USD' })
      const billing = useBillingContext()
      billing.balance = computed(() => balance.value)
      billing.billingStatus = computed(() => 'paid')
      billing.canAccessSubscriptionFeatures = computed(() => true)
      vi.mocked(useBillingContext).mockReturnValue(billing)
      vi.mocked(billing.fetchBalance)
        .mockImplementationOnce(async () => {
          balance.value = { amountMicros: 200, currency: 'USD' }
        })
        .mockImplementationOnce(async () => {
          balance.value = { amountMicros: 75, currency: 'USD' }
        })
      useTeamWorkspaceStore().initState = 'ready'
      Object.assign(useTeamWorkspaceStore(), {
        workspaceName: `${workspaceType} workspace`,
        isInPersonalWorkspace: workspaceType === 'personal'
      })
      const { user } = renderComponent(CurrentUserPopoverWorkspace)

      expect(billing.fetchBalance).not.toHaveBeenCalled()
      await user.click(screen.getByRole('button', { name: 'Current user' }))

      expect(await screen.findByText('422')).toBeInTheDocument()
      expect(billing.fetchBalance).toHaveBeenCalledOnce()

      await user.click(screen.getByRole('button', { name: 'Current user' }))

      await waitFor(() =>
        expect(
          screen.queryByTestId('credits-info-button')
        ).not.toBeInTheDocument()
      )
      expect(billing.fetchBalance).toHaveBeenCalledOnce()

      await user.click(screen.getByRole('button', { name: 'Current user' }))

      expect(await screen.findByText('158')).toBeInTheDocument()
      expect(billing.fetchBalance).toHaveBeenCalledTimes(2)
    }
  )

  it('toggles popover on button click', async () => {
    const { user } = renderComponent()

    expect(screen.queryByText('Popover Content')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Current user' }))

    expect(screen.getByText('Popover Content')).toBeInTheDocument()
  })

  it('restores trigger focus after closing from inside the popover', async () => {
    const { user } = renderComponent()
    const trigger = screen.getByRole('button', { name: 'Current user' })
    await user.click(trigger)
    await user.click(screen.getByTestId('close-popover'))

    expect(trigger).toHaveFocus()
  })

  it.for(['loading', 'error'] as const)(
    'shows account actions while Cloud workspace initialization is %s',
    async (initState) => {
      mockIsCloud.value = true
      useTeamWorkspaceStore().initState = initState
      const { user } = renderComponent()

      await user.click(screen.getByRole('button', { name: 'Current user' }))

      expect(screen.getByText('Workspace Popover Content')).toBeInTheDocument()
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

    expect(screen.getByText('Workspace Popover Content')).toBeInTheDocument()
    expect(screen.queryByText('Popover Content')).not.toBeInTheDocument()
  })
})
