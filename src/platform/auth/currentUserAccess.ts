import type { ComputedRef } from 'vue'

interface CurrentUserAccess {
  readonly userEmail: ComputedRef<string | null | undefined>
  readonly isApiKeyLogin: ComputedRef<boolean>
}

let providedUseCurrentUser: (() => CurrentUserAccess) | undefined

/** Called by `useCurrentUser` when it loads. */
export function provideCurrentUser(useUser: () => CurrentUserAccess): void {
  providedUseCurrentUser = useUser
}

/** `useCurrentUser` for the modules `authStore` depends on, which cannot import it back. */
export function useCurrentUserAccess(): CurrentUserAccess {
  if (!providedUseCurrentUser)
    throw new TypeError('useCurrentUser has not provided itself')

  return providedUseCurrentUser()
}
