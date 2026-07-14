import { computed, ref } from 'vue'

/**
 * Storybook mock for `useWorkspaceUI`.
 *
 * The real composable derives its state from the auth/workspace stores that
 * pull in Firebase and crash in Storybook. This stub presents a billing
 * manager (owner) so role-gated surfaces — the Activity ledger's team-wide
 * scope and its per-user footer — render in their fully-populated form.
 */
export function useWorkspaceUI() {
  return {
    permissions: computed(() => ({ canManageSubscription: true })),
    workspaceRole: ref('owner'),
    workspaceType: ref('team')
  }
}
