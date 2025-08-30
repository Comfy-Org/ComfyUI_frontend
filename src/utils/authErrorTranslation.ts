import { FirebaseError } from 'firebase/app'

import { t, te } from '@/i18n'

/**
 * Translates authentication errors to user-friendly messages.
 * Handles Firebase errors with specific translations, and provides fallbacks for other error types.
 * @param error - Any error object from authentication flows
 * @returns User-friendly error message
 */
export function translateAuthError(error: unknown): string {
  if (error instanceof FirebaseError) {
    const translationKey = `auth.errors.${error.code}`

    // Check if translation exists using te() function
    if (te(translationKey)) {
      return t(translationKey)
    }
  }

  // Fallback to original error message or generic error
  if (error instanceof Error && error.message) {
    return error.message
  }

  return t('g.unknownError')
}
