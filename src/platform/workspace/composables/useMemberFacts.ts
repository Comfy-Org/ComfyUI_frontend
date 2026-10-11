import { computed } from 'vue'
import type { Ref } from 'vue'

import { isCloud } from '@/platform/distribution/types'
import type { ServerFact } from '@/platform/serverFacts/serverFact'
import { receiveServerFact } from '@/platform/serverFacts/serverFact'
import { useBillingCapabilities } from '@/platform/workspace/composables/useBillingCapabilities'
import { useTeamPlan } from '@/platform/workspace/composables/useTeamPlan'
import { useWorkspaceUI } from '@/platform/workspace/composables/useWorkspaceUI'

export interface MemberFacts {
  canInviteMembers: Readonly<Ref<ServerFact<'can_invite_members'>>>
  canManageMembers: Readonly<Ref<ServerFact<'can_manage_members'>>>
}

/**
 * Off Cloud the local build answers the same facts. The body is the existing
 * desktop rule, kept until the local server reports these facts itself.
 */
function useLocalMemberFacts(): MemberFacts {
  const { hasMemberSeats } = useTeamPlan()
  const { workspaceRole } = useWorkspaceUI()
  const localAnswer = computed(
    () => hasMemberSeats.value && workspaceRole.value === 'owner'
  )
  return {
    canInviteMembers: computed(() =>
      receiveServerFact('can_invite_members', localAnswer.value)
    ),
    canManageMembers: computed(() =>
      receiveServerFact('can_manage_members', localAnswer.value)
    )
  }
}

export function useMemberFacts(): MemberFacts {
  if (!isCloud) return useLocalMemberFacts()
  const { canInviteMembers, canManageMembers } = useBillingCapabilities()
  return { canInviteMembers, canManageMembers }
}
