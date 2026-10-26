import { useWorkspaceDialogs } from '@/platform/workspace/composables/useWorkspaceDialogs'
import { receiveServerFact } from '@/platform/serverFacts/serverFact'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'
import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import type { Ref } from 'vue'

import WorkspaceMenuButton from './WorkspaceMenuButton.vue'

vi.mock<unknown>(
  import('@/platform/billing/composables/useBillingContext'),
  () => ({
    useBillingContext: () => ({
      subscription: computed(() => ({
        endDate: '2026-08-01T00:00:00Z',
        isCancelled: false,
        tier: 'PRO'
      }))
    })
  })
)

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))
vi.mock(import('@/platform/workspace/composables/useWorkspaceDialogs'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const LEAVE = 'Leave Workspace'
const DELETE = 'Delete Workspace'

function setLeave(granted: boolean, denial?: string) {
  useBillingCapabilities().canLeaveWorkspace = computed(() =>
    receiveServerFact('can_leave_workspace', granted)
  )
  useBillingCapabilities().leaveWorkspaceDenial = computed(() => denial)
}

function setDelete(granted: boolean, denial?: string) {
  useBillingCapabilities().canDeleteWorkspace = computed(() =>
    receiveServerFact('can_delete_workspace', granted)
  )
  useBillingCapabilities().deleteWorkspaceDenial = computed(() => denial)
}

function hideEdit() {
  useBillingCapabilities().canEditWorkspace = computed(() =>
    receiveServerFact('can_edit_workspace', false)
  )
}

async function openMenu() {
  const user = userEvent.setup()
  render(WorkspaceMenuButton, { global: { plugins: [i18n] } })
  await user.click(screen.getByRole('button', { name: 'More Options' }))
  return user
}

describe('WorkspaceMenuButton', () => {
  beforeEach(() => {
    setLeave(true)
    setDelete(true)
  })

  it('keeps a muted icon unless the header asks for a foreground ghost', () => {
    render(WorkspaceMenuButton, { global: { plugins: [i18n] } })

    expect(screen.getByRole('button', { name: 'More Options' })).toHaveClass(
      'text-muted-foreground'
    )
  })

  it('uses a foreground ghost icon when the header asks for it', () => {
    render(WorkspaceMenuButton, {
      props: { variant: 'textonly' },
      global: { plugins: [i18n] }
    })

    const button = screen.getByRole('button', { name: 'More Options' })
    expect(button).toHaveClass('text-foreground', 'bg-transparent')
    expect(button).not.toHaveClass('text-muted-foreground')
  })

  it('renders no menu when the server grants nothing it can show', () => {
    hideEdit()
    setLeave(false, 'personal_workspace_creator')
    setDelete(false, 'personal_workspace')
    render(WorkspaceMenuButton, { global: { plugins: [i18n] } })

    expect(
      screen.queryByRole('button', { name: 'More Options' })
    ).not.toBeInTheDocument()
  })

  it('hides Leave and Delete until capabilities resolve', async () => {
    hideEdit()
    useBillingCapabilities().hasResolvedCapabilities = computed(() => false)
    useBillingCapabilities().canLeaveWorkspace = computed(() =>
      receiveServerFact('can_leave_workspace', true)
    )
    render(WorkspaceMenuButton, { global: { plugins: [i18n] } })

    expect(
      screen.queryByRole('button', { name: 'More Options' })
    ).not.toBeInTheDocument()
  })

  it.for([
    { label: LEAVE, grant: () => setLeave(true) },
    { label: DELETE, grant: () => setDelete(true) }
  ])('enables $label when the server grants it', async ({ label, grant }) => {
    grant()
    await openMenu()

    expect(screen.getByRole('menuitem', { name: label })).not.toHaveAttribute(
      'aria-disabled'
    )
  })

  it.for([
    {
      denial: 'workspace_creator',
      tooltip: "You created this workspace, so you can't leave it."
    },
    {
      denial: 'only_owner',
      tooltip: 'Make another member an owner before you leave this workspace.'
    },
    {
      denial: 'membership_managed_by_directory',
      tooltip:
        "Your organization manages this membership, so you can't leave this workspace."
    },
    {
      denial: undefined,
      tooltip: "You can't leave this workspace right now."
    }
  ])(
    'disables Leave with its reason when the server denies it with $denial',
    async ({ denial, tooltip }) => {
      setLeave(false, denial)
      const user = await openMenu()

      const leave = screen.getByRole('menuitem', { name: LEAVE })
      expect(leave).toHaveAttribute('aria-disabled', 'true')
      await user.hover(leave)
      expect((await screen.findAllByText(tooltip)).length).toBeGreaterThan(0)
    }
  )

  it.for(['personal_workspace_creator', 'not_a_member'])(
    'hides Leave when the server denies it with %s',
    async (denial) => {
      setLeave(false, denial)
      await openMenu()

      expect(
        screen.queryByRole('menuitem', { name: LEAVE })
      ).not.toBeInTheDocument()
    }
  )

  it.for([
    'plan_not_ended',
    'billing_operation_parked',
    'billing_operation_in_progress',
    undefined
  ])('disables Delete when the server denies it with %s', async (denial) => {
    setDelete(false, denial)
    await openMenu()

    expect(screen.getByRole('menuitem', { name: DELETE })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })

  it.for([
    'not_workspace_owner',
    'personal_workspace',
    'workspace_sso_attached'
  ])('hides Delete when the server denies it with %s', async (denial) => {
    setDelete(false, denial)
    await openMenu()

    expect(
      screen.queryByRole('menuitem', { name: DELETE })
    ).not.toBeInTheDocument()
  })

  it('lists Edit, Leave and Delete in that order', async () => {
    await openMenu()

    expect(
      screen.getAllByRole('menuitem').map((item) => item.textContent.trim())
    ).toEqual(['Edit workspace details', LEAVE, DELETE])
  })

  it.for([
    { canEdit: true, items: ['Edit workspace details', LEAVE] },
    { canEdit: false, items: [LEAVE] }
  ])(
    'renders Edit from can_edit_workspace $canEdit',
    async ({ canEdit, items }) => {
      useBillingCapabilities().canEditWorkspace = computed(() =>
        receiveServerFact('can_edit_workspace', canEdit)
      )
      setDelete(false, 'not_workspace_owner')
      await openMenu()

      expect(
        screen.getAllByRole('menuitem').map((item) => item.textContent.trim())
      ).toEqual(items)
    }
  )

  it('keeps disabled items in keyboard focus order', async () => {
    hideEdit()
    setLeave(false, 'workspace_creator')
    setDelete(false, 'plan_not_ended')
    const user = await openMenu()

    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: LEAVE })).toHaveFocus()
    await user.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: DELETE })).toHaveFocus()
  })

  it.for([
    { label: LEAVE, dialog: 'showLeaveWorkspaceDialog' },
    { label: DELETE, dialog: 'showDeleteWorkspaceDialog' }
  ] as const)(
    'opens the $dialog dialog when the server grants it',
    async ({ label, dialog }) => {
      const user = await openMenu()

      await user.click(screen.getByRole('menuitem', { name: label }))

      expect(useWorkspaceDialogs()[dialog]).toHaveBeenCalledOnce()
    }
  )

  it.for([
    {
      label: LEAVE,
      dialog: 'showLeaveWorkspaceDialog',
      deny: () => setLeave(false, 'workspace_creator')
    },
    {
      label: DELETE,
      dialog: 'showDeleteWorkspaceDialog',
      deny: () => setDelete(false, 'plan_not_ended')
    }
  ] as const)(
    'does not open the $dialog dialog from a disabled item',
    async ({ label, dialog, deny }) => {
      deny()
      const user = await openMenu()

      await user.click(screen.getByRole('menuitem', { name: label }))

      expect(useWorkspaceDialogs()[dialog]).not.toHaveBeenCalled()
    }
  )

  it.for([
    {
      label: LEAVE,
      dialog: 'showLeaveWorkspaceDialog',
      bind: (granted: Ref<boolean>) => {
        useBillingCapabilities().canLeaveWorkspace = computed(() =>
          receiveServerFact('can_leave_workspace', granted.value)
        )
      }
    },
    {
      label: DELETE,
      dialog: 'showDeleteWorkspaceDialog',
      bind: (granted: Ref<boolean>) => {
        useBillingCapabilities().canDeleteWorkspace = computed(() =>
          receiveServerFact('can_delete_workspace', granted.value)
        )
      }
    }
  ] as const)(
    'rechecks the capability before opening the $dialog dialog',
    async ({ label, dialog, bind }) => {
      const granted = ref(true)
      bind(granted)
      await openMenu()

      const item = screen.getByRole('menuitem', { name: label })
      granted.value = false
      item.click()

      expect(useWorkspaceDialogs()[dialog]).not.toHaveBeenCalled()
    }
  )
})
