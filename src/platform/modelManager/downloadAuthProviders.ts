import type { DownloadProvider } from './types'
import { DOWNLOAD_PROVIDERS } from './types'
import { hostFromUrl } from './utils/modelId'

interface DownloadProviderConfig {
  id: DownloadProvider
  /** Brand name, shown as-is (proper noun, not translated). */
  label: string
  /** Primary host that maps to this provider. */
  host: string
  /** Where the user creates a token / API key. */
  tokenUrl: string
  /**
   * Server-side env vars that supply the API key, in resolution order (first
   * match wins). The first entry is the one shown in copy-paste instructions.
   */
  envVars: readonly [string, ...string[]]
  /** Whether this provider can gate models behind a per-model access request. */
  canBeGated: boolean
}

const PROVIDER_CONFIGS: Record<DownloadProvider, DownloadProviderConfig> = {
  huggingface: {
    id: 'huggingface',
    label: 'HuggingFace',
    host: 'huggingface.co',
    tokenUrl: 'https://huggingface.co/settings/tokens',
    envVars: ['HF_TOKEN', 'HUGGING_FACE_HUB_TOKEN'],
    canBeGated: true
  },
  civitai: {
    id: 'civitai',
    label: 'Civitai',
    host: 'civitai.com',
    tokenUrl: 'https://civitai.com/user/account',
    envVars: ['CIVITAI_API_TOKEN', 'CIVITAI_API_KEY'],
    canBeGated: false
  }
}

export const DOWNLOAD_PROVIDER_CONFIGS: DownloadProviderConfig[] =
  DOWNLOAD_PROVIDERS.map((provider) => PROVIDER_CONFIGS[provider])

export function getProviderConfig(
  provider: DownloadProvider
): DownloadProviderConfig {
  return PROVIDER_CONFIGS[provider]
}

/**
 * The `export FOO="..."` snippet shown in the env-var instructions, using the
 * provider's primary env var.
 */
export function envExportSnippet(provider: DownloadProvider): string {
  const { id, envVars } = PROVIDER_CONFIGS[provider]
  const placeholder = id === 'huggingface' ? 'hf_xxx' : 'xxxx'
  return `export ${envVars[0]}="${placeholder}"`
}

/**
 * Maps a host (e.g. `huggingface.co`, `www.civitai.com`) to its provider, or
 * `undefined` when no provider owns it. Subdomains match their parent host.
 */
export function providerForHost(
  host: string | null | undefined
): DownloadProvider | undefined {
  if (!host) return undefined
  const normalized = host.toLowerCase()
  return DOWNLOAD_PROVIDERS.find((provider) => {
    const { host: base } = PROVIDER_CONFIGS[provider]
    return normalized === base || normalized.endsWith(`.${base}`)
  })
}

/** Maps a full URL to its provider, or `undefined` when unparseable/unknown. */
export function providerForUrl(url: string): DownloadProvider | undefined {
  return providerForHost(hostFromUrl(url))
}
