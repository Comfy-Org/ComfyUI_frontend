import { storeToRefs } from 'pinia'
import { computed } from 'vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useBillingContext } from '@/composables/billing/useBillingContext'
import type { WorkspaceMember } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

/**
 * Identify the creator (original owner) of the workspace.
 *
 * The cloud workspace model is single-owner: the acting owner is the creator
 * and can never be removed. Creator detection is the current user's email,
 * matching the guard shared with FE-770 (promote / demote members).
 */
function isCreator(
  member: WorkspaceMember,
  currentUserEmail: string | null
): boolean {
  return (
    member.role === 'owner' ||
    member.email.toLowerCase() === currentUserEmail?.toLowerCase()
  )
}

/**
 * Orchestrates a team-plan downgrade to a personal plan (FE-977).
 *
 * On downgrade every member except the creator is removed immediately, then the
 * tier change is initiated. The tier change itself takes effect at cycle end
 * while unused credits persist; the end state is a personal plan, solo workspace.
 *
 * BE seam: the automatic "remove all members on downgrade + send email"
 * side-effect does not exist server-side yet (email is BE-owned). Until a
 * dedicated downgrade endpoint lands, the FE orchestrates `removeMember` calls
 * and initiates the tier change via the existing subscribe path.
 */
export function useDowngradeToPersonal() {
  const workspaceStore = useTeamWorkspaceStore()
  const { members } = storeToRefs(workspaceStore)
  const { userEmail } = useCurrentUser()
  const { subscribe } = useBillingContext()

  const removableMembers = computed(() =>
    members.value.filter(
      (member) => !isCreator(member, userEmail.value ?? null)
    )
  )

  const hasOtherMembers = computed(() => removableMembers.value.length > 0)

  async function downgradeToPersonal(planSlug: string): Promise<void> {
    for (const member of removableMembers.value) {
      await workspaceStore.removeMember(member.id)
    }
    await subscribe(planSlug)
  }

  return {
    removableMembers,
    hasOtherMembers,
    downgradeToPersonal
  }
}
