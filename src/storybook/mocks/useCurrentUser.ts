import { computed, ref } from 'vue'

/** The signed-in identity a story wants the stub to report. */
export interface CurrentUserMockState {
  displayName: string | undefined
  email: string | undefined
  isLoggedIn: boolean
}

const defaultState: CurrentUserMockState = {
  displayName: 'Ada Lovelace',
  email: 'ada@example.com',
  isLoggedIn: true
}

const state = ref<CurrentUserMockState>({ ...defaultState })

/** Drives the stub from a story's `beforeEach`. */
export function setCurrentUserMock(next: Partial<CurrentUserMockState>) {
  state.value = { ...defaultState, ...next }
}

/** Storybook mock for `useCurrentUser`, driven by `setCurrentUserMock`. */
export function useCurrentUser() {
  return {
    userDisplayName: computed(() => state.value.displayName),
    userEmail: computed(() => state.value.email),
    userPhotoUrl: ref<string | null>(null),
    resolvedUserInfo: ref({ id: 'user-ada' }),
    isAuthInitialized: computed(() => true),
    isLoggedIn: computed(() => state.value.isLoggedIn),
    isApiKeyLogin: computed(() => false),
    handleSignOut: async () => {}
  }
}
