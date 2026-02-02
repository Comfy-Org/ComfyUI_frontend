import type { SecretProvider } from './types'

interface ProviderConfig {
  value: SecretProvider
  label: string
}

export const SECRET_PROVIDERS: ProviderConfig[] = [
  { value: 'huggingface', label: 'HuggingFace' },
  { value: 'civitai', label: 'Civitai' }
] as const

export function getProviderLabel(provider: SecretProvider | undefined): string {
  if (!provider) return ''
  const config = SECRET_PROVIDERS.find((p) => p.value === provider)
  return config?.label ?? provider
}
