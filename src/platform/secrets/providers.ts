interface ProviderConfig {
  /** Provider identifier as returned by `GET /secrets/providers`. */
  value: string
  /** Human-facing display label. Brand names are intentionally not translated. */
  label: string
  /** Path to the provider logo under `public/assets/images/`. */
  logo: string
  /** Optional i18n key for provider-specific help text shown under the picker. */
  helpKey?: string
}

/**
 * Presentational metadata for known providers: how a provider id renders
 * (label, logo, help text). This table is NOT the source of truth for which
 * providers a user may configure — that list is server-driven via
 * `GET /secrets/providers`. Ids the server returns that are absent here fall
 * back to the raw id with no logo, so adding a provider server-side renders
 * without an FE change (a dedicated logo/label is an optional enhancement).
 */
const SECRET_PROVIDERS: ProviderConfig[] = [
  {
    value: 'huggingface',
    label: 'HuggingFace',
    logo: '/assets/images/hf-logo.svg'
  },
  { value: 'civitai', label: 'Civitai', logo: '/assets/images/civitai.svg' },
  {
    value: 'runway',
    label: 'Runway',
    logo: '/assets/images/runway.svg',
    helpKey: 'secrets.providerHelp.runway'
  },
  {
    value: 'gemini',
    label: 'Google Gemini',
    logo: '/assets/images/gemini.svg',
    helpKey: 'secrets.providerHelp.gemini'
  }
]

/**
 * Providers shown as a sensible default before the server list resolves, and to
 * seed the disabled selector in edit mode. This is NOT the source of truth for
 * which providers a user may configure — once `GET /secrets/providers` resolves,
 * its list is rendered verbatim.
 */
export const DEFAULT_PROVIDER_IDS = ['huggingface', 'civitai'] as const

function findProvider(
  provider: string | undefined
): ProviderConfig | undefined {
  if (!provider) return undefined
  return SECRET_PROVIDERS.find((p) => p.value === provider)
}

export function getProviderLabel(provider: string | undefined): string {
  if (!provider) return ''
  return findProvider(provider)?.label ?? provider
}

export function getProviderLogo(
  provider: string | undefined
): string | undefined {
  return findProvider(provider)?.logo
}

export function getProviderHelpKey(
  provider: string | undefined
): string | undefined {
  return findProvider(provider)?.helpKey
}

/**
 * DEMO SHIM (BE-3128 / FE-1281): a credential-entry option for a provider that
 * supports more than one credential shape. This mirrors the `credential_options`
 * metadata the backend will advertise on `GET /secrets/providers` (BE-3128).
 * It is hardcoded here only so the Gemini "AI Studio API key vs Vertex service
 * account" sub-selection can be demoed against production before that backend
 * field ships. DELETE once the endpoint advertises credential_options and the
 * form renders the sub-selection from server data (FE-1281).
 */
export interface CredentialOptionConfig {
  credentialType: 'api_key' | 'gcp_service_account'
  inputType: 'text' | 'json_file'
  label: string
}

const DEMO_CREDENTIAL_OPTIONS: Record<string, CredentialOptionConfig[]> = {
  gemini: [
    {
      credentialType: 'api_key',
      inputType: 'text',
      label: 'API key (Google AI Studio)'
    },
    {
      credentialType: 'gcp_service_account',
      inputType: 'json_file',
      label: 'Service account (Vertex AI / Gemini Enterprise)'
    }
  ]
}

/**
 * The credential-entry options a provider offers. An empty array means the
 * provider has a single implicit api_key/text credential (the common case), so
 * callers render no sub-selection.
 */
export function getCredentialOptions(
  provider: string | undefined
): CredentialOptionConfig[] {
  if (!provider) return []
  return DEMO_CREDENTIAL_OPTIONS[provider] ?? []
}
