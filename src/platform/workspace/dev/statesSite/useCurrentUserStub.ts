/**
 * Build-time replacement for `@/composables/auth/useCurrentUser` in the states
 * viewer (wired via alias in vite.states.config.mts). Supplies a signed-in
 * identity without Firebase; the email matches the billingMockHarness roster
 * self row so useMemberCreditDisplay resolves the member cap.
 */
import { computed, ref } from 'vue'

const USER = { id: 'user-self' }

export const useCurrentUser = () => ({
  loading: ref(false),
  isLoggedIn: computed(() => true),
  isApiKeyLogin: computed(() => false),
  isEmailProvider: computed(() => false),
  userDisplayName: computed(() => 'Alex Tov'),
  userEmail: computed(() => 'alextov@comfy.org'),
  userPhotoUrl: computed(() => null),
  providerName: computed(() => 'Google'),
  providerIcon: computed(() => 'pi pi-google'),
  resolvedUserInfo: computed(() => USER),
  handleSignOut: async () => {},
  handleSignIn: async () => {},
  onUserResolved: (callback: (user: typeof USER) => void) => {
    callback(USER)
    return () => {}
  },
  onTokenRefreshed: () => () => {},
  onUserLogout: () => () => {}
})
