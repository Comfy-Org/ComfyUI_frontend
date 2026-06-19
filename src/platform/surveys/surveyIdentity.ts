import { createUuidv4 } from '@/utils/uuid'

const ANON_ID_KEY = 'Comfy.SurveyAnonId'

export interface SurveyIdentity {
  /** Stable local id, present for the user's whole journey across opt-in/login. */
  anon_id: string
  /** PostHog distinct id, bridging responses to product analytics when present. */
  distinct_id?: string
  /** Set only for an authenticated (consented) user. */
  comfy_id?: string
}

export interface IdentityProvider {
  getIdentity(): SurveyIdentity
}

let memoryAnonId: string | undefined

export function getOrCreateAnonId(): string {
  try {
    const existing = localStorage.getItem(ANON_ID_KEY)
    if (existing) return existing

    const anonId = createUuidv4()
    localStorage.setItem(ANON_ID_KEY, anonId)
    return anonId
  } catch {
    // Storage disabled: degrade to an in-memory id so a feedback click never throws.
    return (memoryAnonId ??= createUuidv4())
  }
}

export const anonymousIdentityProvider: IdentityProvider = {
  getIdentity: () => ({ anon_id: getOrCreateAnonId() })
}

let currentProvider: IdentityProvider = anonymousIdentityProvider

export function setCurrentIdentityProvider(provider: IdentityProvider): void {
  currentProvider = provider
}

function getSurveyIdentity(): SurveyIdentity {
  return currentProvider.getIdentity()
}

/** Identity as Typeform hidden-field tags, dropping any absent field. */
export function getSurveyIdentityTags(): Record<string, string> {
  const { anon_id, distinct_id, comfy_id } = getSurveyIdentity()
  return {
    anon_id,
    ...(distinct_id ? { distinct_id } : {}),
    ...(comfy_id ? { comfy_id } : {})
  }
}

/** Formats tags as Typeform's comma-separated `key=value` hidden-field string. */
export function formatTypeformHiddenFields(
  tags: Record<string, string>
): string {
  return Object.entries(tags)
    .map(([key, value]) => `${key}=${value}`)
    .join(',')
}
