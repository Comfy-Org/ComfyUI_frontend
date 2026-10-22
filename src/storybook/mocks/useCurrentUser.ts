import { computed, ref } from 'vue'

/** Storybook mock for `useCurrentUser` that presents a static signed-in user. */
export function useCurrentUser() {
  return {
    userDisplayName: ref('Ada Lovelace'),
    userEmail: ref('ada@example.com'),
    resolvedUserInfo: ref({ id: 'user-ada' }),
    isAuthInitialized: computed(() => true),
    isLoggedIn: computed(() => true),
    isApiKeyLogin: computed(() => false)
  }
}
