import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ServerFact } from '@/platform/serverFacts/serverFact'
import { useBillingCapabilities } from '@/platform/billing/composables/useBillingCapabilities'

type LeaveWorkspaceGate =
  | { status: 'hidden' }
  | { status: 'enabled' }
  | { status: 'disabled'; denial: string | undefined }

interface LeaveWorkspaceGateInput {
  resolved: boolean
  canLeave: ServerFact<'can_leave_workspace'>
  denial: string | undefined
}

const HIDDEN_DENIALS: ReadonlySet<string> = new Set([
  'not_a_member',
  'personal_workspace_creator'
])

const DENIAL_TOOLTIP_KEYS: Readonly<Record<string, string>> = {
  workspace_creator: 'workspacePanel.menu.leaveWorkspaceCreatorTooltip',
  only_owner: 'workspacePanel.menu.leaveWorkspaceOnlyOwnerTooltip',
  membership_managed_by_directory:
    'workspacePanel.menu.leaveWorkspaceDirectoryTooltip'
}

const GENERIC_TOOLTIP_KEY =
  'workspacePanel.menu.leaveWorkspaceUnavailableTooltip'

function resolveLeaveWorkspaceGate({
  resolved,
  canLeave,
  denial
}: LeaveWorkspaceGateInput): LeaveWorkspaceGate {
  if (!resolved) return { status: 'hidden' }
  if (canLeave) return { status: 'enabled' }
  if (denial !== undefined && HIDDEN_DENIALS.has(denial)) {
    return { status: 'hidden' }
  }
  return { status: 'disabled', denial }
}

export function useLeaveWorkspaceGate() {
  const { t } = useI18n()
  const { canLeaveWorkspace, leaveWorkspaceDenial, hasResolvedCapabilities } =
    useBillingCapabilities()

  const gate = computed(() =>
    resolveLeaveWorkspaceGate({
      resolved: hasResolvedCapabilities.value,
      canLeave: canLeaveWorkspace.value,
      denial: leaveWorkspaceDenial.value
    })
  )

  const tooltip = computed(() => {
    const current = gate.value
    if (current.status !== 'disabled') return undefined
    return t(
      (current.denial && DENIAL_TOOLTIP_KEYS[current.denial]) ||
        GENERIC_TOOLTIP_KEY
    )
  })

  return { gate, tooltip }
}
