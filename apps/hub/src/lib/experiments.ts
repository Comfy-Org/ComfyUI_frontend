/**
 * A/B Testing Infrastructure for Static Sites
 *
 * Uses Vercel Edge Config for feature flags when deployed,
 * falls back to URL params and cookies for local testing.
 */

export interface Experiment {
  id: string
  variants: string[]
  weights?: number[] // Optional weights for non-uniform distribution
}

export interface ExperimentConfig {
  [experimentId: string]: {
    variants: string[]
    weights?: number[]
    enabled?: boolean
  }
}

/**
 * Types for analytics globals (inline to avoid Window extension conflicts)
 */
type VaFunction = (command: string, payload: Record<string, unknown>) => void
type GtagFunction = (
  command: string,
  event: string,
  params: Record<string, unknown>
) => void

const COOKIE_PREFIX = 'exp_'
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days
const CONFIG_CACHE_TTL = 5 * 60 * 1000 // 5 minutes in milliseconds

/**
 * Get variant assignment from URL params (for testing)
 */
function getVariantFromUrl(experimentId: string): string | null {
  if (typeof window === 'undefined') return null

  const params = new URLSearchParams(window.location.search)
  return params.get(`variant_${experimentId}`) || params.get('variant')
}

/**
 * Get variant assignment from cookie
 */
function getVariantFromCookie(experimentId: string): string | null {
  if (typeof document === 'undefined') return null

  const cookies = document.cookie.split(';')
  const cookieName = `${COOKIE_PREFIX}${experimentId}=`

  for (const cookie of cookies) {
    const trimmed = cookie.trim()
    if (trimmed.startsWith(cookieName)) {
      return trimmed.substring(cookieName.length)
    }
  }
  return null
}

/**
 * Save variant assignment to cookie
 */
function setVariantCookie(experimentId: string, variant: string): void {
  if (typeof document === 'undefined') return

  document.cookie = `${COOKIE_PREFIX}${experimentId}=${variant}; max-age=${COOKIE_MAX_AGE}; path=/; SameSite=Lax`
}

/**
 * Randomly assign a variant based on weights
 */
function assignVariant(variants: string[], weights?: number[]): string {
  if (!weights || weights.length !== variants.length) {
    return variants[Math.floor(Math.random() * variants.length)]
  }

  const totalWeight = weights.reduce((sum, w) => sum + w, 0)
  let random = Math.random() * totalWeight

  for (let i = 0; i < variants.length; i++) {
    random -= weights[i]
    if (random <= 0) {
      return variants[i]
    }
  }

  return variants[variants.length - 1]
}

/**
 * Fetch experiment config from Vercel Edge Config
 */
async function fetchEdgeConfig(): Promise<ExperimentConfig | null> {
  const edgeConfigId = import.meta.env.PUBLIC_EDGE_CONFIG_ID
  const edgeConfigToken = import.meta.env.PUBLIC_EDGE_CONFIG_TOKEN

  if (!edgeConfigId || !edgeConfigToken) {
    return null
  }

  try {
    const response = await fetch(
      `https://edge-config.vercel.com/${edgeConfigId}/item/experiments?token=${edgeConfigToken}`
    )

    if (!response.ok) {
      console.warn('[A/B] Failed to fetch Edge Config:', response.status)
      return null
    }

    return await response.json()
  } catch (error) {
    console.warn('[A/B] Edge Config fetch error:', error)
    return null
  }
}

let cachedConfig: ExperimentConfig | null = null
let configFetchPromise: Promise<ExperimentConfig | null> | null = null
let cacheTimestamp: number = 0

/**
 * Clear the experiment config cache
 */
export function clearConfigCache(): void {
  cachedConfig = null
  configFetchPromise = null
  cacheTimestamp = 0
}

/**
 * Get experiment configuration (cached with TTL)
 */
async function getExperimentConfig(): Promise<ExperimentConfig | null> {
  // Check if cache is still valid
  if (cachedConfig && Date.now() - cacheTimestamp < CONFIG_CACHE_TTL) {
    return cachedConfig
  }

  // Cache expired or empty, fetch fresh
  if (!configFetchPromise) {
    configFetchPromise = fetchEdgeConfig().then((config) => {
      cachedConfig = config
      cacheTimestamp = Date.now()
      configFetchPromise = null // Reset promise after completion
      return config
    })
  }

  return configFetchPromise
}

/**
 * Get the assigned variant for an experiment
 *
 * Priority:
 * 1. URL param override (for testing)
 * 2. Existing cookie assignment
 * 3. Edge Config (if available)
 * 4. Fallback config
 */
export async function getVariant(
  experimentId: string,
  fallbackConfig?: Experiment
): Promise<string> {
  // 1. Check URL param override
  const urlVariant = getVariantFromUrl(experimentId)
  if (urlVariant) {
    return urlVariant
  }

  // 2. Check existing cookie
  const cookieVariant = getVariantFromCookie(experimentId)
  if (cookieVariant) {
    return cookieVariant
  }

  // 3. Try Edge Config
  const edgeConfig = await getExperimentConfig()
  const experimentConfig = edgeConfig?.[experimentId]

  if (experimentConfig?.enabled !== false) {
    const config = experimentConfig || fallbackConfig
    if (config) {
      const variant = assignVariant(config.variants, config.weights)
      setVariantCookie(experimentId, variant)
      return variant
    }
  }

  // 4. Fallback to control
  return 'control'
}

/**
 * Synchronous variant getter (uses only cookies/URL, no Edge Config)
 * Use when you need immediate rendering without async
 */
export function getVariantSync(
  experimentId: string,
  fallbackConfig: Experiment
): string {
  // 1. Check URL param override
  const urlVariant = getVariantFromUrl(experimentId)
  if (urlVariant) {
    return urlVariant
  }

  // 2. Check existing cookie
  const cookieVariant = getVariantFromCookie(experimentId)
  if (cookieVariant) {
    return cookieVariant
  }

  // 3. Assign new variant
  const variant = assignVariant(fallbackConfig.variants, fallbackConfig.weights)
  setVariantCookie(experimentId, variant)
  return variant
}

/**
 * Track experiment exposure in Vercel Analytics
 */
export function trackExposure(experimentId: string, variant: string): void {
  if (typeof window === 'undefined') return

  const va = (window as { va?: VaFunction }).va
  const gtag = (window as { gtag?: GtagFunction }).gtag

  // Track via Vercel Analytics custom event
  if (va) {
    va('event', {
      name: 'experiment_exposure',
      data: {
        experiment_id: experimentId,
        variant: variant
      }
    })
  }

  // Also track via web-vitals attribution if available
  if (gtag) {
    gtag('event', 'experiment_exposure', {
      experiment_id: experimentId,
      variant: variant
    })
  }
}

/**
 * Track conversion event for an experiment
 */
export function trackConversion(
  experimentId: string,
  conversionType: string
): void {
  if (typeof window === 'undefined') return

  const variant = getVariantFromCookie(experimentId)
  if (!variant) return

  const va = (window as { va?: VaFunction }).va

  if (va) {
    va('event', {
      name: 'experiment_conversion',
      data: {
        experiment_id: experimentId,
        variant: variant,
        conversion_type: conversionType
      }
    })
  }
}

/**
 * Pre-defined experiments for easy reuse
 */
export const EXPERIMENTS = {
  CTA_BUTTON: {
    id: 'cta_button',
    variants: ['control', 'variant_a', 'variant_b']
  },
  HERO_LAYOUT: {
    id: 'hero_layout',
    variants: ['control', 'centered', 'split']
  },
  FEATURE_FLAG: {
    id: 'new_feature',
    variants: ['off', 'on'],
    weights: [0.9, 0.1] // 10% rollout
  }
} as const

/**
 * React-style hook helper for client-side components
 * Returns a function that initializes the experiment
 */
export function createExperimentHandler(
  experimentId: string,
  fallbackConfig: Experiment
) {
  return {
    getVariant: () => getVariantSync(experimentId, fallbackConfig),
    track: () => {
      const variant = getVariantSync(experimentId, fallbackConfig)
      trackExposure(experimentId, variant)
      return variant
    },
    trackConversion: (type: string) => trackConversion(experimentId, type)
  }
}
