const MODEL_TO_LOGO: Record<string, string> = {
  Grok: 'grok',
  OpenAI: 'openai',
  'GPT-Image': 'openai',
  Wan: 'wan',
  Flux: 'bfl',
  LTX: 'ltxv',
  LTXV: 'ltxv',
  Lightricks: 'ltxv',
  Google: 'gemini',
  Gemini: 'gemini',
  'Nano Banana': 'gemini',
  Veo: 'gemini',
  Runway: 'runway',
  Luma: 'luma',
  Kling: 'kling',
  Hunyuan: 'tencent',
  ByteDance: 'bytedance',
  Seedance: 'bytedance',
  Seedream: 'bytedance',
  Topaz: 'topaz',
  Minimax: 'minimax',
  MiniMax: 'minimax',
  Ideogram: 'ideogram',
  Qwen: 'qwen',
  ElevenLabs: 'elevenlabs'
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const LOGO_MATCHERS: [RegExp, string][] = Object.entries(MODEL_TO_LOGO).map(
  ([key, slug]) => [
    new RegExp(`(?:^|[^a-z0-9])${escapeRegex(key.toLowerCase())}(?![a-z])`),
    slug
  ]
)

function getLogoPath(name: string): string | null {
  const normalized = name.trim()
  const slug = MODEL_TO_LOGO[normalized]
  if (slug) return `/icons/ai-models/${slug}.svg`
  const lower = normalized.toLowerCase()
  const match = LOGO_MATCHERS.find(([pattern]) => pattern.test(lower))
  return match ? `/icons/ai-models/${match[1]}.svg` : null
}

export interface ModelBadge {
  readonly src: string
  readonly name: string
}

// Structured `logos` first, then the model list; deduped by asset so alias
// pairs like Google + Gemini yield one badge.
export function resolveTemplateLogos(input: {
  readonly models?: readonly string[]
  readonly logos?: readonly { provider: string | string[] }[]
}): ModelBadge[] {
  const providers = (input.logos ?? []).flatMap((l) =>
    Array.isArray(l.provider) ? l.provider : [l.provider]
  )
  const names = providers.length > 0 ? providers : (input.models ?? [])
  const seen = new Set<string>()
  return names.flatMap((name) => {
    const src = getLogoPath(name)
    if (!src || seen.has(src)) return []
    seen.add(src)
    return [{ src, name }]
  })
}
