import type { WorkshopModel } from '../config/workshop'
import { getWorkshopModel } from '../config/workshop'

export interface DiscoveryModel {
  readonly model: WorkshopModel
  readonly logo: string
  /** Single-colour logos are masked so they take the card's text colour. */
  readonly mono: boolean
}

// The home page lineup, in display order.
const LINEUP: readonly { slug: string; logo: string; mono?: boolean }[] = [
  { slug: 'seedance-2', logo: 'bytedance' },
  { slug: 'kling-o3', logo: 'kling' },
  { slug: 'veo-3', logo: 'veo' },
  { slug: 'nano-banana-2', logo: 'gemini' },
  { slug: 'grok-imagine', logo: 'grok' },
  { slug: 'flux-2-api', logo: 'bfl', mono: true },
  { slug: 'wan2-7', logo: 'wan' },
  { slug: 'minimax', logo: 'minimax' },
  { slug: 'ltx-2', logo: 'ltxv', mono: true },
  { slug: 'openai-dall-e', logo: 'openai' },
  { slug: 'elevenlabs', logo: 'elevenlabs', mono: true },
  { slug: 'runway', logo: 'runway', mono: true },
  { slug: 'qwen-3', logo: 'qwen' },
  { slug: 'luma-dream-machine', logo: 'luma' },
  { slug: 'topaz-labs', logo: 'topaz', mono: true },
  { slug: 'hunyuan-3d', logo: 'tencent' }
]

export const discoveryModels: readonly DiscoveryModel[] = LINEUP.flatMap(
  ({ slug, logo, mono = false }) => {
    const model = getWorkshopModel(slug)
    return model ? [{ model, logo: `/icons/ai-models/${logo}.svg`, mono }] : []
  }
)
