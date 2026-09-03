import { workshopModels } from '../config/workshop'

export interface DiscoveryProvider {
  readonly name: string
  /** Masked onto the card, so every logo renders in the card's text colour. */
  readonly logo: string
  readonly modelCount: number
  readonly thumbnailUrl?: string
}

// The home page lineup, in display order. A provider only appears once its
// logo is drawn, so the row stays a wall of marks rather than of initials.
const LINEUP: readonly { provider: string; logo: string }[] = [
  { provider: 'ByteDance', logo: 'bytedance' },
  { provider: 'Kling', logo: 'kling' },
  { provider: 'Ideogram', logo: 'ideogram' },
  { provider: 'Google', logo: 'gemini' },
  { provider: 'xAI', logo: 'grok' },
  { provider: 'Black Forest Labs', logo: 'bfl' },
  { provider: 'Alibaba', logo: 'wan' },
  { provider: 'MiniMax', logo: 'minimax' },
  { provider: 'Lightricks', logo: 'ltxv' },
  { provider: 'OpenAI', logo: 'openai' },
  { provider: 'ElevenLabs', logo: 'elevenlabs' },
  { provider: 'Runway', logo: 'runway' },
  { provider: 'Luma', logo: 'luma' },
  { provider: 'Topaz Labs', logo: 'topaz' },
  { provider: 'Tencent', logo: 'tencent' }
]

// A card stands for everything the provider runs, so it opens the catalogue
// already narrowed to them rather than one model's page.
export const discoveryProviders: readonly DiscoveryProvider[] = LINEUP.flatMap(
  ({ provider, logo }) => {
    const models = workshopModels.filter((model) => model.provider === provider)
    const popular = [...models].sort((a, b) => b.runs - a.runs)[0]
    return popular
      ? [
          {
            name: provider,
            logo: `/icons/ai-models/${logo}.svg`,
            modelCount: models.length,
            thumbnailUrl: popular.thumbnailUrl
          }
        ]
      : []
  }
)
