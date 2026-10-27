import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, createApp, defineComponent } from 'vue'
import type { App } from 'vue'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { receiveServerFact } from '@/platform/serverFacts/serverFact'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

import { useDeleteWorkspaceGate as createDeleteWorkspaceGate } from './useDeleteWorkspaceGate'

interface TestSubscription {
  endDate: string | null
  isCancelled: boolean
}

const subscription = vi.hoisted(() => ({
  value: { endDate: null, isCancelled: false } as TestSubscription
}))

vi.mock<unknown>(
  import('@/platform/billing/composables/useBillingContext'),
  () => ({
    useBillingContext: () => ({
      subscription: computed(() => subscription.value)
    })
  })
)

vi.mock(import('@/platform/billing/composables/useBillingCapabilities'))

const apps: App<Element>[] = []

function useDeleteWorkspaceGate() {
  let result: ReturnType<typeof createDeleteWorkspaceGate> | undefined
  const app = createApp(
    defineComponent({
      setup() {
        result = createDeleteWorkspaceGate()
        return () => null
      }
    })
  )
  app.use(
    createI18n({ legacy: false, locale: 'en', messages: { en: enMessages } })
  )
  app.mount(document.createElement('div'))
  apps.push(app)
  if (!result) throw new Error('delete workspace gate not initialized')
  return result
}

function serve({
  canDelete = false,
  denial,
  resolved = true
}: {
  canDelete?: boolean
  denial?: string
  resolved?: boolean
}) {
  const capabilities = useBillingCapabilities()
  capabilities.canDeleteWorkspace = computed(() =>
    receiveServerFact('can_delete_workspace', canDelete)
  )
  capabilities.deleteWorkspaceDenial = computed(() => denial)
  capabilities.hasResolvedCapabilities = computed(() => resolved)
}

beforeEach(() => {
  subscription.value = { endDate: null, isCancelled: false }
})

afterEach(() => {
  for (const app of apps.splice(0)) app.unmount()
})

describe('useDeleteWorkspaceGate', () => {
  it.for([
    { denial: 'personal_workspace', status: 'hidden' },
    { denial: 'workspace_sso_attached', status: 'hidden' },
    { denial: 'not_workspace_owner', status: 'hidden' },
    { denial: 'not_a_member', status: 'hidden' },
    { denial: 'sales_managed_plan', status: 'hidden' },
    { denial: 'plan_not_ended', status: 'disabled' },
    { denial: 'billing_operation_parked', status: 'disabled' },
    { denial: 'billing_operation_in_progress', status: 'disabled' },
    { denial: 'not_original_owner', status: 'disabled' },
    { denial: 'a_reason_this_client_predates', status: 'disabled' },
    { denial: undefined, status: 'disabled' }
  ])('renders a refusal of $denial as $status', ({ denial, status }) => {
    serve({ denial })

    expect(useDeleteWorkspaceGate().gate.value.status).toBe(status)
  })

  it('enables Delete when the server grants it', () => {
    serve({ canDelete: true })

    expect(useDeleteWorkspaceGate().gate.value).toEqual({ status: 'enabled' })
  })

  it('does not grant Delete before capabilities resolve', () => {
    serve({ canDelete: true, resolved: false })

    expect(useDeleteWorkspaceGate().gate.value).toEqual({ status: 'hidden' })
  })

  it.for([
    {
      denial: 'plan_not_ended',
      tooltip:
        'You can delete this workspace after its plan ends. Cancel it from Manage plan.'
    },
    {
      denial: 'billing_operation_parked',
      tooltip: 'A recent payment needs a fix from our team. Contact support.'
    },
    {
      denial: 'billing_operation_in_progress',
      tooltip: 'A billing change is in progress. Try again in a moment.'
    },
    {
      denial: 'not_original_owner',
      tooltip: "This workspace can't be deleted right now."
    },
    {
      denial: undefined,
      tooltip: "This workspace can't be deleted right now."
    }
  ])('explains a refusal of $denial', ({ denial, tooltip }) => {
    serve({ denial })

    expect(useDeleteWorkspaceGate().tooltip.value).toBe(tooltip)
  })

  it('names the served end date for a plan that is ending', () => {
    subscription.value = {
      ...subscription.value,
      isCancelled: true,
      endDate: '2026-08-01T00:00:00Z'
    }
    serve({ denial: 'plan_not_ended' })

    expect(useDeleteWorkspaceGate().tooltip.value).toBe(
      'You can delete this workspace after your plan ends on Aug 1, 2026.'
    )
  })

  it('does not name a date the server did not serve', () => {
    subscription.value = { ...subscription.value, isCancelled: true }
    serve({ denial: 'plan_not_ended' })

    expect(useDeleteWorkspaceGate().tooltip.value).toBe(
      'You can delete this workspace after its plan ends. Cancel it from Manage plan.'
    )
  })

  it.for([
    { canDelete: true, denial: undefined },
    { canDelete: false, denial: 'personal_workspace' }
  ])('offers no tooltip for $denial when not disabled', (input) => {
    serve(input)

    expect(useDeleteWorkspaceGate().tooltip.value).toBeUndefined()
  })
})
