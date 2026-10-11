import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import WorkspaceMembersPanelContent from './WorkspaceMembersPanelContent.vue'

vi.mock(import('@/platform/distribution/types'), () => ({ isCloud: true }))
vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/composables/billing/useBillingContext'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/services/dialogService'))
vi.mock(
  import('@/platform/cloud/subscription/composables/useSubscriptionDialog')
)

const stubs = {
  MembersPanelContent: { template: '<div data-testid="members-body" />' }
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missingWarn: false,
  fallbackWarn: false
})

function renderComponent() {
  return render(WorkspaceMembersPanelContent, {
    global: { stubs, plugins: [i18n] }
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('WorkspaceMembersPanelContent', () => {
  let workspaceStore: ReturnType<typeof useTeamWorkspaceStore>

  beforeEach(() => {
    useBillingCapabilities().canManageMembers = computed(() => true)
    const workspaceUI = vi.mocked(useWorkspaceUI())
    workspaceUI.workspaceRole = computed(() => 'owner')
    const ownerPermissions = workspaceUI.permissions.value
    workspaceUI.permissions = computed(() => ({
      ...ownerPermissions,
      canViewPendingInvites: true
    }))
    workspaceStore = useTeamWorkspaceStore()
    vi.mocked(workspaceStore.fetchMembers).mockResolvedValue([])
    vi.mocked(workspaceStore.fetchPendingInvites).mockResolvedValue([])
  })

  it.for([true, false])(
    'uses the members-panel permission when workspace role defaults disagree (management: %s)',
    async (canManage) => {
      useBillingCapabilities().canManageMembers = computed(() => canManage)
      const workspaceUI = vi.mocked(useWorkspaceUI())
      const rolePermissions = workspaceUI.permissions.value
      workspaceUI.permissions = computed(() => ({
        ...rolePermissions,
        canViewPendingInvites: !canManage
      }))

      renderComponent()
      await nextTick()

      expect(workspaceStore.fetchMembers).toHaveBeenCalledTimes(1)
      expect(workspaceStore.fetchPendingInvites).toHaveBeenCalledTimes(
        canManage ? 1 : 0
      )
    }
  )

  it('fetches members and pending invites on mount', () => {
    renderComponent()
    expect(workspaceStore.fetchMembers).toHaveBeenCalled()
    expect(workspaceStore.fetchPendingInvites).toHaveBeenCalled()
  })

  it('surfaces a retryable error when a fetch fails, and clears it on retry', async () => {
    vi.mocked(workspaceStore.fetchMembers).mockRejectedValueOnce(
      new Error('members failed')
    )

    renderComponent()

    expect(
      await screen.findByText('workspacePanel.members.loadFailed')
    ).toBeInTheDocument()
    expect(screen.getByTestId('members-body')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'g.retry' }))

    await waitFor(() =>
      expect(
        screen.queryByText('workspacePanel.members.loadFailed')
      ).not.toBeInTheDocument()
    )
    expect(workspaceStore.fetchMembers).toHaveBeenCalledTimes(2)
  })

  it('skips the invites fetch for members who cannot view pending invites', async () => {
    const workspaceUI = vi.mocked(useWorkspaceUI())
    const permissions = workspaceUI.permissions.value
    workspaceUI.permissions = computed(() => ({
      ...permissions,
      canViewPendingInvites: false
    }))
    useBillingCapabilities().canManageMembers = computed(() => false)
    vi.mocked(workspaceStore.fetchPendingInvites).mockRejectedValue(
      new Error('403')
    )

    renderComponent()
    await Promise.resolve()

    expect(workspaceStore.fetchMembers).toHaveBeenCalled()
    expect(workspaceStore.fetchPendingInvites).not.toHaveBeenCalled()
    expect(
      screen.queryByText('workspacePanel.members.loadFailed')
    ).not.toBeInTheDocument()
  })

  it('loads personal-owner pending invites once management resolves', async () => {
    const canManage = ref(false)
    useBillingCapabilities().canManageMembers = computed(() => canManage.value)
    const workspaceUI = vi.mocked(useWorkspaceUI())
    const permissions = workspaceUI.permissions.value
    workspaceUI.permissions = computed(() => ({
      ...permissions,
      canViewPendingInvites: false
    }))

    renderComponent()
    expect(workspaceStore.fetchPendingInvites).not.toHaveBeenCalled()

    canManage.value = true

    await waitFor(() =>
      expect(workspaceStore.fetchPendingInvites).toHaveBeenCalledTimes(1)
    )
    expect(workspaceStore.fetchMembers).toHaveBeenCalledTimes(1)
  })

  it('keeps a failed retry visible after an older member request succeeds', async () => {
    const initial =
      deferred<Awaited<ReturnType<typeof workspaceStore.fetchMembers>>>()
    vi.mocked(workspaceStore.fetchMembers).mockReturnValueOnce(initial.promise)
    vi.mocked(workspaceStore.fetchPendingInvites).mockRejectedValueOnce(
      new Error('invites failed')
    )
    vi.mocked(workspaceStore.fetchMembers).mockRejectedValueOnce(
      new Error('retry failed')
    )

    renderComponent()
    await screen.findByText('workspacePanel.members.loadFailed')
    await userEvent.click(screen.getByRole('button', { name: 'g.retry' }))
    await waitFor(() => {
      expect(workspaceStore.fetchMembers).toHaveBeenCalledTimes(2)
      expect(
        screen.getByText('workspacePanel.members.loadFailed')
      ).toBeInTheDocument()
    })

    initial.resolve([])
    await initial.promise
    await nextTick()

    expect(
      screen.getByText('workspacePanel.members.loadFailed')
    ).toBeInTheDocument()
  })

  it('keeps a successful retry clear after an older member request fails', async () => {
    const initial =
      deferred<Awaited<ReturnType<typeof workspaceStore.fetchMembers>>>()
    vi.mocked(workspaceStore.fetchMembers).mockReturnValueOnce(initial.promise)
    vi.mocked(workspaceStore.fetchPendingInvites).mockRejectedValueOnce(
      new Error('invites failed')
    )

    renderComponent()
    await screen.findByText('workspacePanel.members.loadFailed')
    await userEvent.click(screen.getByRole('button', { name: 'g.retry' }))
    await waitFor(() => {
      expect(workspaceStore.fetchMembers).toHaveBeenCalledTimes(2)
      expect(
        screen.queryByText('workspacePanel.members.loadFailed')
      ).not.toBeInTheDocument()
    })

    initial.reject(new Error('stale failure'))
    await initial.promise.catch(() => {})
    await nextTick()

    expect(
      screen.queryByText('workspacePanel.members.loadFailed')
    ).not.toBeInTheDocument()
  })

  it('preserves a member failure when a later invite-only load succeeds', async () => {
    const canManage = ref(false)
    useBillingCapabilities().canManageMembers = computed(() => canManage.value)
    vi.mocked(workspaceStore.fetchMembers).mockRejectedValueOnce(
      new Error('members failed')
    )
    renderComponent()
    await screen.findByText('workspacePanel.members.loadFailed')

    canManage.value = true
    await waitFor(() =>
      expect(workspaceStore.fetchPendingInvites).toHaveBeenCalledTimes(1)
    )
    expect(
      screen.getByText('workspacePanel.members.loadFailed')
    ).toBeInTheDocument()
    expect(workspaceStore.fetchMembers).toHaveBeenCalledTimes(1)

    await userEvent.click(screen.getByRole('button', { name: 'g.retry' }))
    await waitFor(() =>
      expect(
        screen.queryByText('workspacePanel.members.loadFailed')
      ).not.toBeInTheDocument()
    )
    expect(workspaceStore.fetchMembers).toHaveBeenCalledTimes(2)
    expect(workspaceStore.fetchPendingInvites).toHaveBeenCalledTimes(2)
  })

  it('ignores invite failures after permission is revoked and retries on a new grant', async () => {
    const canManage = ref(true)
    useBillingCapabilities().canManageMembers = computed(() => canManage.value)
    const initial =
      deferred<Awaited<ReturnType<typeof workspaceStore.fetchPendingInvites>>>()
    vi.mocked(workspaceStore.fetchPendingInvites).mockReturnValueOnce(
      initial.promise
    )
    renderComponent()

    canManage.value = false
    await nextTick()
    initial.reject(new Error('revoked invite request'))
    await initial.promise.catch(() => {})
    await nextTick()
    expect(
      screen.queryByText('workspacePanel.members.loadFailed')
    ).not.toBeInTheDocument()

    canManage.value = true
    await waitFor(() =>
      expect(workspaceStore.fetchPendingInvites).toHaveBeenCalledTimes(2)
    )
    expect(workspaceStore.fetchMembers).toHaveBeenCalledTimes(1)
    expect(
      screen.queryByText('workspacePanel.members.loadFailed')
    ).not.toBeInTheDocument()
  })

  it('ignores failures from the previous workspace after switching', async () => {
    const workspaceId = ref('first')
    vi.spyOn(workspaceStore, 'activeWorkspaceId', 'get').mockImplementation(
      () => workspaceId.value
    )
    const initial =
      deferred<Awaited<ReturnType<typeof workspaceStore.fetchMembers>>>()
    vi.mocked(workspaceStore.fetchMembers).mockReturnValueOnce(initial.promise)
    renderComponent()

    workspaceId.value = 'second'
    await waitFor(() =>
      expect(workspaceStore.fetchMembers).toHaveBeenCalledTimes(2)
    )
    expect(workspaceStore.fetchPendingInvites).toHaveBeenCalledTimes(2)
    initial.reject(new Error('previous workspace failure'))
    await initial.promise.catch(() => {})
    await nextTick()
    expect(
      screen.queryByText('workspacePanel.members.loadFailed')
    ).not.toBeInTheDocument()
  })

  it('shows no error state when both fetches succeed', async () => {
    renderComponent()
    await Promise.resolve()

    expect(
      screen.queryByText('workspacePanel.members.loadFailed')
    ).not.toBeInTheDocument()
  })
})
