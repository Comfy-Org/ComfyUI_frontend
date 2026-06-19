const PREFER_APP_TEMPLATES_KEY = 'Comfy.Onboarding.PreferAppTemplates'

export function setPreferAppTemplates(prefer: boolean): void {
  try {
    localStorage.setItem(PREFER_APP_TEMPLATES_KEY, String(prefer))
  } catch {
    // Non-critical hint; ignore unavailable/full localStorage.
  }
}

/**
 * Reads and clears the one-time onboarding hint. Cleared on read so it only
 * seeds the template picker's content-type filter on the first open after
 * onboarding, leaving the user's later choice in control.
 */
export function consumePreferAppTemplates(): boolean {
  try {
    const value = localStorage.getItem(PREFER_APP_TEMPLATES_KEY)
    localStorage.removeItem(PREFER_APP_TEMPLATES_KEY)
    return value === 'true'
  } catch {
    return false
  }
}
