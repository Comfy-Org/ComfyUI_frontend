import { useCurrentUser } from 'vuefire'

/**
 * The only identity fields a caller needs to decide whether the signed-in user
 * belongs to a given email domain.
 */
export type UserIdentity = {
  email: string | null
  emailVerified: boolean
}

/**
 * Reads Firebase auth straight from VueFire rather than through `authStore`,
 * which would pull the whole app module graph into the caller. Returns
 * undefined until auth resolves and null when nobody is signed in.
 */
export function getCurrentUserIdentity(): UserIdentity | null | undefined {
  try {
    const user = useCurrentUser().value
    if (!user) return user
    return { email: user.email, emailVerified: user.emailVerified }
  } catch {
    return null
  }
}
