import type { WorkshopModel } from '../config/workshop'
import { getWorkshopModel } from '../config/workshop'

export interface DiscoveryModel {
  readonly model: WorkshopModel
  readonly logo?: string
}

// The home page lineup, in display order. Logos exist only for the providers
// the site already ships icons for; the rest render a monogram.
const LINEUP: readonly { slug: string; logo?: string }[] = [
  { slug: 'seedance-2', logo: 'bytedance' },
  { slug: 'kling-o3' },
  { slug: 'veo-3', logo: 'gemini' },
  { slug: 'nano-banana-2', logo: 'gemini' },
  { slug: 'grok-imagine', logo: 'grok' },
  { slug: 'flux-2-api' },
  { slug: 'wan2-7', logo: 'wan' },
  { slug: 'minimax', logo: 'minimax' },
  { slug: 'ltx-2' },
  { slug: 'openai-dall-e', logo: 'openai' },
  { slug: 'elevenlabs' },
  { slug: 'runway' },
  { slug: 'qwen-3', logo: 'qwen' },
  { slug: 'krea-2' },
  { slug: 'topaz-labs' },
  { slug: 'hunyuan-3d' }
]

export const discoveryModels: readonly DiscoveryModel[] = LINEUP.flatMap(
  ({ slug, logo }) => {
    const model = getWorkshopModel(slug)
    if (!model) return []
    return [
      { model, ...(logo ? { logo: `/icons/ai-models/${logo}.svg` } : {}) }
    ]
  }
)
