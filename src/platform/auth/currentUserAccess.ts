import type { ComputedRef } from 'vue'

interface CurrentUserAccess {
  readonly userEmail: ComputedRef<string | null | undefined>
  readonly isApiKeyLogin: ComputedRef<boolean>
}

/** `useCurrentUser` for the modules `authStore` depends on, which cannot import it back. */
export let useCurrentUserAccess: () => CurrentUserAccess

/** Called by `useCurrentUser` when it loads. */
export function provideCurrentUser(useUser: () => CurrentUserAccess): void {
  useCurrentUserAccess = useUser
}
