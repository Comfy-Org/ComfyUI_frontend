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

type MaybePromise<T> = T | Promise<T>

export interface IdentityProvider {
  getIdentity(): MaybePromise<Partial<SurveyIdentity> | null | undefined>
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

/**
 * Identity as Typeform hidden-field tags, dropping any absent field.
 */
export async function getSurveyIdentityTags(): Promise<Record<string, string>> {
  const identity = await currentProvider.getIdentity()
  const { distinct_id, comfy_id } = identity ?? {}
  return {
    anon_id: identity?.anon_id ?? getOrCreateAnonId(),
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
