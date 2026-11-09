import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useBillingContext } from '@/platform/billing/composables/useBillingContext'
import type { ServerFact } from '@/platform/serverFacts/serverFact'
import { formatSubscriptionDate } from '@/platform/billing/components/subscriptionPanelWorkspace.logic'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

type DeleteWorkspaceGate =
  | { status: 'hidden' }
  | { status: 'enabled' }
  | { status: 'disabled'; denial: string | undefined }

interface DeleteWorkspaceGateInput {
  resolved: boolean
  canDelete: ServerFact<'can_delete_workspace'>
  denial: string | undefined
}

const HIDDEN_DENIALS: ReadonlySet<string> = new Set([
  'not_a_member',
  'not_workspace_owner',
  'personal_workspace',
  'sales_managed_plan',
  'workspace_sso_attached'
])

const DENIAL_TOOLTIP_KEYS: Readonly<Record<string, string>> = {
  plan_not_ended: 'workspacePanel.menu.deleteWorkspacePlanNotEndedTooltip',
  billing_operation_parked:
    'workspacePanel.menu.deleteWorkspaceBillingParkedTooltip',
  billing_operation_in_progress:
    'workspacePanel.menu.deleteWorkspaceBillingInProgressTooltip'
}

const GENERIC_TOOLTIP_KEY =
  'workspacePanel.menu.deleteWorkspaceUnavailableTooltip'

function resolveDeleteWorkspaceGate({
  resolved,
  canDelete,
  denial
}: DeleteWorkspaceGateInput): DeleteWorkspaceGate {
  if (!resolved) return { status: 'hidden' }
  if (canDelete) return { status: 'enabled' }
  if (denial !== undefined && HIDDEN_DENIALS.has(denial)) {
    return { status: 'hidden' }
  }
  return { status: 'disabled', denial }
}

export function useDeleteWorkspaceGate() {
  const { t, locale } = useI18n()
  const { subscription } = useBillingContext()
  const { canDeleteWorkspace, deleteWorkspaceDenial, hasResolvedCapabilities } =
    useBillingCapabilities()

  const gate = computed(() =>
    resolveDeleteWorkspaceGate({
      resolved: hasResolvedCapabilities.value,
      canDelete: canDeleteWorkspace.value,
      denial: deleteWorkspaceDenial.value
    })
  )

  const tooltip = computed(() => {
    const current = gate.value
    if (current.status !== 'disabled') return undefined
    const planEndDate =
      current.denial === 'plan_not_ended' && subscription.value?.isCancelled
        ? formatSubscriptionDate(subscription.value.endDate, locale.value)
        : undefined
    if (planEndDate) {
      return t('workspacePanel.menu.deleteWorkspaceAfterPlanEndsTooltip', {
        date: planEndDate
      })
    }
    const key =
      (current.denial && DENIAL_TOOLTIP_KEYS[current.denial]) ||
      GENERIC_TOOLTIP_KEY
    return t(key)
  })

  return { gate, tooltip }
}
