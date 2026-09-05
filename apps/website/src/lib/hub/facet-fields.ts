import type { WorkshopModel } from '../../config/workshop'
import { partnerModelFor } from './template-use-case'
import type { HubTemplate } from './types'

const INDUSTRIES = [
  'Advertising',
  'VFX',
  'Animation',
  'Ecommerce',
  'Gaming',
  'Film',
  'Product',
  'Social'
] as const

type Industry = (typeof INDUSTRIES)[number]

export type FacetedTemplate = HubTemplate & {
  readonly partner?: string
  readonly industries: readonly Industry[]
}

// The registry does not record who a workflow is for, so the prototype reads it
// off what the workflow already says about itself. A tag that clearly belongs to
// a trade names it; everything else falls back to a stable pick, so the same
// workflow keeps the same industries between visits.
const BY_TAG: Partial<Record<string, readonly Industry[]>> = {
  '3D': ['Gaming', 'Product'],
  Anime: ['Animation', 'Social'],
  'Character Reference': ['Gaming', 'Film'],
  'Image Upscale': ['Product', 'Ecommerce'],
  'Image to 3D': ['Gaming', 'Product'],
  'Image to Video': ['Advertising', 'Social'],
  Inpainting: ['Ecommerce', 'Product'],
  'Lip Sync': ['Film', 'Social'],
  'Motion Control': ['VFX', 'Film'],
  Portrait: ['Social', 'Advertising'],
  'Remove Background': ['Ecommerce', 'Product'],
  'Style Reference': ['Advertising', 'Animation'],
  'Style Transfer': ['Advertising', 'Animation'],
  'Text to Image': ['Advertising', 'Social'],
  'Text to Video': ['Film', 'Advertising'],
  'Video Edit': ['VFX', 'Film'],
  'Video Upscale': ['VFX', 'Film']
}

function fallbackIndustry(name: string): Industry {
  let sum = 0
  for (let i = 0; i < name.length; i++) sum += name.charCodeAt(i)
  return INDUSTRIES[sum % INDUSTRIES.length]
}

function industriesFor(template: HubTemplate): readonly Industry[] {
  const named = template.tags.flatMap((tag) => BY_TAG[tag] ?? [])
  return named.length > 0
    ? [...new Set(named)]
    : [fallbackIndustry(template.name)]
}

export function withFacetFields(
  template: HubTemplate,
  models: readonly WorkshopModel[]
): FacetedTemplate {
  return {
    ...template,
    partner: partnerModelFor(template, models)?.provider,
    industries: industriesFor(template)
  }
}
