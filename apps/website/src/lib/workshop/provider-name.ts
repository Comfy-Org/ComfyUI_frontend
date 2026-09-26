const PROVIDER_NAMES: Readonly<Record<string, string>> = {
  bfl: 'Black Forest Labs',
  byteplus: 'ByteDance',
  'byteplus-mediakit': 'ByteDance',
  elevenlabs: 'ElevenLabs',
  fishaudio: 'Fish Audio',
  gemini: 'Google',
  ltx: 'Lightricks',
  luma_2: 'Luma',
  openai: 'OpenAI',
  synclabs: 'Sync Labs',
  'tencent-hunyuan3d': 'Tencent',
  vertexai: 'Google',
  wavespeed: 'WaveSpeed',
  xai: 'xAI'
}

export function providerName(provider: string): string {
  if (Object.hasOwn(PROVIDER_NAMES, provider)) return PROVIDER_NAMES[provider]
  return provider
    .split('-')
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(' ')
}
