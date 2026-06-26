import { createTestingPinia } from '@pinia/testing'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'

import CurrentUserPopoverWorkspace from './CurrentUserPopoverWorkspace.vue'

const showCreateWorkspaceDialog = vi.fn()

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    userDisplayName: ref('Liz'),
    userEmail: ref('liz@example.com'),
    userPhotoUrl: ref(null),
    handleSignOut: vi.fn()
  })
}))

vi.mock('@/composables/billing/useBillingContext', () => ({
  useBillingContext: () => ({
    isActiveSubscription: ref(true),
    isFreeTier: ref(false),
    subscription: ref(null),
    balance: ref(null),
    isLoading: ref(false),
    fetchBalance: vi.fn()
  })
}))

vi.mock('@/platform/workspace/composables/useWorkspaceUI', () => ({
  useWorkspaceUI: () => ({
    permissions: computed(() => ({
      canTopUp: false,
      canManageSubscription: false
    }))
  })
}))

vi.mock(
  '@/platform/cloud/subscription/composables/useSubscriptionDialog',
  () => ({
    useSubscriptionDialog: () => ({ showPricingTable: vi.fn() })
  })
)

vi.mock('@/platform/settings/composables/useSettingsDialog', () => ({
  useSettingsDialog: () => ({ show: vi.fn() })
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({
    showCreateWorkspaceDialog,
    showTopUpCreditsDialog: vi.fn()
  })
}))

vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => undefined
}))

vi.mock('@/composables/useExternalLink', () => ({
  useExternalLink: () => ({
    buildDocsUrl: vi.fn(() => 'https://docs.comfy.org'),
    docsPaths: { partnerNodesPricing: 'partner-nodes' }
  })
}))

const WorkspaceSwitcherPopoverStub = defineComponent({
  emits: ['select', 'create'],
  template: `
    <div>
      <button data-testid="stub-select-workspace" @click="$emit('select')" />
      <button data-testid="stub-create-workspace" @click="$emit('create')" />
    </div>
  `
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderComponent() {
  return render(CurrentUserPopoverWorkspace, {
    global: {
      plugins: [
        createTestingPinia({
          createSpy: vi.fn,
          initialState: {
            teamWorkspace: {
              initState: 'ready',
              activeWorkspaceId: 'ws-personal'
            }
          }
        }),
        i18n
      ],
      directives: {
        tooltip: {}
      },
      stubs: {
        WorkspaceSwitcherPopover: WorkspaceSwitcherPopoverStub,
        SubscribeButton: true,
        UserAvatar: true,
        WorkspaceProfilePic: true,
        Skeleton: true,
        Divider: true
      }
    }
  })
}

describe('CurrentUserPopoverWorkspace', () => {
  it('toggles the workspace switcher panel from the selector row', async () => {
    const user = userEvent.setup()
    renderComponent()

    expect(
      screen.queryByTestId('workspace-switcher-panel')
    ).not.toBeInTheDocument()

    await user.click(screen.getByTestId('workspace-switcher-trigger'))
    expect(screen.getByTestId('workspace-switcher-panel')).toBeInTheDocument()

    await user.click(screen.getByTestId('workspace-switcher-trigger'))
    expect(
      screen.queryByTestId('workspace-switcher-panel')
    ).not.toBeInTheDocument()
  })

  it('closes the switcher panel after selecting a workspace', async () => {
    const user = userEvent.setup()
    renderComponent()

    await user.click(screen.getByTestId('workspace-switcher-trigger'))
    await user.click(screen.getByTestId('stub-select-workspace'))

    expect(
      screen.queryByTestId('workspace-switcher-panel')
    ).not.toBeInTheDocument()
  })

  it('opens the create-workspace dialog and closes the popover on create', async () => {
    const user = userEvent.setup()
    const { emitted } = renderComponent()

    await user.click(screen.getByTestId('workspace-switcher-trigger'))
    await user.click(screen.getByTestId('stub-create-workspace'))

    expect(showCreateWorkspaceDialog).toHaveBeenCalled()
    expect(emitted('close')).toHaveLength(1)
    expect(
      screen.queryByTestId('workspace-switcher-panel')
    ).not.toBeInTheDocument()
  })
})
