import type { SecretProvider } from './types'

interface ProviderConfig {
  value: SecretProvider
  label: string
  logo: string
}

export const SECRET_PROVIDERS: ProviderConfig[] = [
  {
    value: 'huggingface',
    label: 'HuggingFace',
    logo: '/assets/images/hf-logo.svg'
  },
  { value: 'civitai', label: 'Civitai', logo: '/assets/images/civitai.svg' }
] as const

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
  const config = SECRET_PROVIDERS.find((p) => p.value === provider)
  return config?.label ?? provider
}

export function getProviderLogo(
  provider: string | undefined
): string | undefined {
  if (!provider) return undefined
  const config = SECRET_PROVIDERS.find((p) => p.value === provider)
  return config?.logo
}
