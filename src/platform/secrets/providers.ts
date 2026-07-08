import type { SecretProvider } from './types'

interface ProviderConfig {
  label: string
  logo?: string
}

/**
 * Display metadata (label + optional logo) for known providers, keyed by the
 * free-form provider id. Providers not listed here fall back to their raw id as
 * the label and render without a logo.
 */
const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  huggingface: { label: 'HuggingFace', logo: '/assets/images/hf-logo.svg' },
  civitai: { label: 'Civitai', logo: '/assets/images/civitai.svg' },
  gemini: { label: 'Gemini' },
  runway: { label: 'Runway' }
}

/**
 * Base providers shown in the add-secret dropdown before/without a
 * server-provided list. Partner providers are surfaced only when the server
 * returns them and the BYOK flag is on (see `BYOK_PARTNER_PROVIDERS`), so they
 * are intentionally excluded from this fallback set.
 */
export const SECRET_PROVIDERS: readonly SecretProvider[] = [
  'huggingface',
  'civitai'
]

/**
 * BYOK (bring-your-own-key) partner providers. The server payload does not mark
 * providers as partner-owned, so this is the known-id allowlist gated behind the
 * `byokPartnerNodesEnabled` feature flag. Base providers (huggingface, civitai)
 * are never gated here.
 */
export const BYOK_PARTNER_PROVIDERS: ReadonlySet<string> = new Set([
  'gemini',
  'runway'
])

export function getProviderLabel(provider: string | undefined): string {
  if (!provider) return ''
  return PROVIDER_CONFIGS[provider]?.label ?? provider
}

export function getProviderLogo(
  provider: string | undefined
): string | undefined {
  if (!provider) return undefined
  return PROVIDER_CONFIGS[provider]?.logo
}
