import { useWorkspaceDialogs } from '@/platform/workspace/composables/useWorkspaceDialogs'
import { receiveServerFact } from '@/platform/serverFacts/serverFact'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

import WorkspaceMenuButton from './WorkspaceMenuButton.vue'

const mockCanLeaveWorkspace = ref(false)

vi.mock<unknown>(import('@/composables/billing/useBillingContext'), () => ({
  useBillingContext: () => ({
    subscription: computed(() => ({
      endDate: '2026-08-01T00:00:00Z',
      isCancelled: false,
      tier: 'PRO'
    }))
  })
}))

vi.mock(import('@/platform/workspace/composables/useBillingCapabilities'))

vi.mock(import('@/platform/workspace/composables/useWorkspaceUI'))

vi.mock(import('@/platform/workspace/composables/useWorkspaceDialogs'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function grantDelete() {
  useBillingCapabilities().canDeleteWorkspace = computed(() =>
    receiveServerFact('can_delete_workspace', true)
  )
}

function denyDelete(denial: string | undefined) {
  useBillingCapabilities().canDeleteWorkspace = computed(() =>
    receiveServerFact('can_delete_workspace', false)
  )
  useBillingCapabilities().deleteWorkspaceDenial = computed(() => denial)
}

async function renderComponent() {
  render(WorkspaceMenuButton, {
    global: {
      plugins: [i18n],
      directives: { tooltip: {} }
    }
  })
  await userEvent.click(screen.getByRole('button', { name: 'More Options' }))
}

describe('WorkspaceMenuButton', () => {
  beforeEach(() => {
    const workspaceUI = vi.mocked(useWorkspaceUI())
    const defaultPermissions = workspaceUI.permissions.value
    workspaceUI.permissions = computed(() => ({
      ...defaultPermissions,
      canLeaveWorkspace: mockCanLeaveWorkspace.value
    }))
    mockCanLeaveWorkspace.value = false
    grantDelete()
  })

  it('lets a member leave and offers no destructive workspace actions', async () => {
    mockCanLeaveWorkspace.value = true
    denyDelete('not_workspace_owner')
    await renderComponent()

    expect(
      screen.getByRole('menuitem', { name: 'Leave Workspace' })
    ).toBeEnabled()
    expect(
      screen.queryByRole('menuitem', { name: 'Delete Workspace' })
    ).not.toBeInTheDocument()
  })

  it('lets a workspace owner leave and delete when the server grants Delete', async () => {
    const user = userEvent.setup()
    mockCanLeaveWorkspace.value = true
    await renderComponent()

    expect(
      screen.getByRole('menuitem', { name: 'Leave Workspace' })
    ).toBeEnabled()
    expect(
      screen.getByRole('menuitem', { name: 'Delete Workspace' })
    ).toBeEnabled()

    await user.click(screen.getByRole('menuitem', { name: 'Delete Workspace' }))
    expect(
      useWorkspaceDialogs().showDeleteWorkspaceDialog
    ).toHaveBeenCalledOnce()
  })

  it.for(['personal_workspace', 'workspace_sso_attached'])(
    'does not expose Delete when the server names %s',
    async (denial) => {
      denyDelete(denial)
      await renderComponent()

      expect(
        screen.queryByRole('menuitem', { name: 'Delete Workspace' })
      ).not.toBeInTheDocument()
    }
  )

  it.for(['plan_not_ended', 'billing_operation_parked', undefined])(
    'disables Delete when the server refuses it with %s',
    async (denial) => {
      denyDelete(denial)
      await renderComponent()

      expect(
        screen.getByRole('menuitem', { name: 'Delete Workspace' })
      ).toHaveAttribute('aria-disabled', 'true')
    }
  )

  it('hides Delete until capabilities resolve', async () => {
    useBillingCapabilities().hasResolvedCapabilities = computed(() => false)
    await renderComponent()

    expect(
      screen.queryByRole('menuitem', { name: 'Delete Workspace' })
    ).not.toBeInTheDocument()
  })

  it('hides Leave when workspace permission is withheld', async () => {
    await renderComponent()

    expect(
      screen.queryByRole('menuitem', { name: 'Leave Workspace' })
    ).not.toBeInTheDocument()
  })

  it('opens the leave dialog when an owner clicks Leave', async () => {
    const user = userEvent.setup()
    mockCanLeaveWorkspace.value = true
    await renderComponent()

    await user.click(screen.getByRole('menuitem', { name: 'Leave Workspace' }))
    expect(
      useWorkspaceDialogs().showLeaveWorkspaceDialog
    ).toHaveBeenCalledOnce()
  })

  it('rechecks permission before opening the leave dialog', async () => {
    mockCanLeaveWorkspace.value = true
    await renderComponent()

    const leave = screen.getByRole('menuitem', { name: 'Leave Workspace' })
    mockCanLeaveWorkspace.value = false
    leave.click()

    expect(
      useWorkspaceDialogs().showLeaveWorkspaceDialog
    ).not.toHaveBeenCalled()
  })

  it('rechecks the capability before opening the delete dialog', async () => {
    const granted = ref(true)
    useBillingCapabilities().canDeleteWorkspace = computed(() =>
      receiveServerFact('can_delete_workspace', granted.value)
    )
    await renderComponent()

    const deleteWorkspace = screen.getByRole('menuitem', {
      name: 'Delete Workspace'
    })
    granted.value = false
    deleteWorkspace.click()

    expect(
      useWorkspaceDialogs().showDeleteWorkspaceDialog
    ).not.toHaveBeenCalled()
  })
})
