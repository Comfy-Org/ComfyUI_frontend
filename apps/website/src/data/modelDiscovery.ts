import type { WorkshopModel } from '../config/workshop'
import { getWorkshopModel } from '../config/workshop'

export interface DiscoveryModel {
  readonly model: WorkshopModel
  /** Masked onto the card, so every logo renders in the card's text colour. */
  readonly logo: string
}

// The home page lineup, in display order.
const LINEUP: readonly { slug: string; logo: string }[] = [
  { slug: 'seedance-2', logo: 'bytedance' },
  { slug: 'kling-o3', logo: 'kling' },
  { slug: 'ideogram', logo: 'ideogram' },
  { slug: 'nano-banana-2', logo: 'gemini' },
  { slug: 'grok-imagine', logo: 'grok' },
  { slug: 'flux-2-api', logo: 'bfl' },
  { slug: 'wan2-7', logo: 'wan' },
  { slug: 'minimax', logo: 'minimax' },
  { slug: 'ltx-2', logo: 'ltxv' },
  { slug: 'openai-dall-e', logo: 'openai' },
  { slug: 'elevenlabs', logo: 'elevenlabs' },
  { slug: 'runway', logo: 'runway' },
  { slug: 'qwen-3', logo: 'qwen' },
  { slug: 'luma-dream-machine', logo: 'luma' },
  { slug: 'topaz-labs', logo: 'topaz' },
  { slug: 'hunyuan-3d', logo: 'tencent' }
]

export const discoveryModels: readonly DiscoveryModel[] = LINEUP.flatMap(
  ({ slug, logo }) => {
    const model = getWorkshopModel(slug)
    return model ? [{ model, logo: `/icons/ai-models/${logo}.svg` }] : []
  }
)
