import { externalLinks } from '../config/routes'
import { getWorkshopModel } from '../config/workshop'

export type HubWorkflowKind = 'graph' | 'app'

export interface HubWorkflow {
  readonly kind: HubWorkflowKind
  readonly title: string
  readonly author: string
  readonly tags: readonly string[]
  readonly href: string
  readonly thumbnailUrl?: string
}

interface HubWorkflowSeed {
  readonly kind: HubWorkflowKind
  readonly title: string
  readonly author: string
  readonly tags: readonly string[]
  readonly thumbnailOf: string
}

// Stand-ins for community items on comfy.org/workflows, so partner models can
// be shown living next to node graphs and Comfy Apps in the prototype.
const SEEDS: readonly HubWorkflowSeed[] = [
  {
    kind: 'graph',
    title: 'Consistent character sheet',
    author: '@studio_mira',
    tags: ['Text to Image', 'Characters'],
    thumbnailOf: 'ideogram'
  },
  {
    kind: 'app',
    title: 'Headshot studio',
    author: '@pixelforge',
    tags: ['Image to Image', 'Portraits'],
    thumbnailOf: 'grok-imagine'
  },
  {
    kind: 'graph',
    title: 'Restore and upscale old photos',
    author: '@archive.lab',
    tags: ['Image to Image', 'Upscale'],
    thumbnailOf: 'topaz-labs'
  },
  {
    kind: 'app',
    title: 'Music video generator',
    author: '@beatframe',
    tags: ['Audio to Video', 'Music'],
    thumbnailOf: 'minimax'
  },
  {
    kind: 'graph',
    title: 'Storyboard to animatic',
    author: '@frames.co',
    tags: ['Image to Video', 'Storyboards'],
    thumbnailOf: 'kling-o3'
  },
  {
    kind: 'app',
    title: 'Logo animator',
    author: '@motionmint',
    tags: ['Image to Video', 'Branding'],
    thumbnailOf: 'runway'
  }
]

export const hubWorkflows: readonly HubWorkflow[] = SEEDS.map((seed) => ({
  kind: seed.kind,
  title: seed.title,
  author: seed.author,
  tags: seed.tags,
  href: externalLinks.workflows,
  thumbnailUrl: getWorkshopModel(seed.thumbnailOf)?.thumbnailUrl
}))
