import { computed, ref } from 'vue'

/**
 * Storybook mock for `useCurrentUser`.
 *
 * The real composable reads the Firebase-backed `authStore`, whose setup
 * resolves the identity module's Firebase while remote config is unloaded,
 * which throws in Storybook. This static stub presents a signed-in user so
 * components that only need the display name / email (e.g.
 * WorkspaceActivityContent's member self-scope) render without any auth.
 */
export function useCurrentUser() {
  return {
    userDisplayName: ref('Ada Lovelace'),
    userEmail: ref('ada@example.com'),
    resolvedUserInfo: ref({ id: 'user-ada' }),
    isLoggedIn: computed(() => true)
  }
}
