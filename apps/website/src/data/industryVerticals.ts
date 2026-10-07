import type { FeatureRow } from '@/components/blocks/FeatureRows01.vue'
import type { VideoTrack } from '@/components/common/VideoPlayer.vue'
import { getCustomerVideoStory } from '@/data/customerVideos'
import workshopDisplay from '@/content/workshop-display.json'
import hubTemplates from '@/data/hubTemplates.json'
import { learningTutorials } from '@/data/learningTutorials'
import type { LearningTutorial } from '@/data/learningTutorials'
import type { TranslationKey } from '@/i18n/translations'
import { hubTemplatesSchema } from '@/lib/hub/types'
import type { HubTemplate } from '@/lib/hub/types'

export type IndustryVerticalId =
  | 'advertising'
  | 'film-animation'
  | 'architectural-visualization'

interface IndustryFeaturedWorkflow {
  title: string
  href: string
  media: string
  mediaType: 'video' | 'image'
  poster?: string
  tags: string[]
  models?: string[]
}

export interface IndustryVertical {
  id: IndustryVerticalId
  keysPrefix: `industry.${IndustryVerticalId}`
  badgeKey: TranslationKey
  storySlug?: 'black-math' | 'silverside-ai'
  hero: {
    type: 'video' | 'image'
    src: string
    poster: string
    tracks?: readonly VideoTrack[]
  }
  workflows: { template: HubTemplate; href: string }[]
  featured: IndustryFeaturedWorkflow[]
  examples: {
    id: string
    titleKey: TranslationKey
    descriptionKey: TranslationKey
    media: FeatureRow['media']
  }[]
}

const templates = hubTemplatesSchema.parse(hubTemplates)

function templateFor(name: string): HubTemplate {
  const template = templates.find((item) => item.name === name)
  if (!template) throw new Error(`Unknown industry workflow: ${name}`)
  return template
}

function workflow(name: string) {
  const template = templateFor(name)
  const page = workshopDisplay.find((item) => item.template?.id === name)
  if (!page) throw new Error(`Missing industry workflow page: ${name}`)
  return { template, href: `/hub/${page.slug}/` }
}

function cloudWorkflow(name: string) {
  const template = templateFor(name)
  const page = workshopDisplay.find((item) => item.template?.id === name)
  return {
    template,
    href: page
      ? `/hub/${page.slug}/`
      : `https://cloud.comfy.org/?template=${encodeURIComponent(name)}`
  }
}

function cloudWorkflowSlide(name: string): IndustryFeaturedWorkflow {
  const { template, href } = cloudWorkflow(name)
  const media = imageMedia(name)
  return {
    title: template.title,
    href,
    media: media.src,
    mediaType: 'image',
    tags: [...template.tags],
    models: [...template.models]
  }
}

function tutorial(id: string): LearningTutorial & { videoSrc: string } {
  const item = learningTutorials.find((entry) => entry.id === id)
  if (!item?.videoSrc) throw new Error(`Missing industry tutorial video: ${id}`)
  return { ...item, videoSrc: item.videoSrc }
}

function tutorialMedia(id: string): FeatureRow['media'] {
  const item = tutorial(id)
  return {
    type: 'video',
    src: item.videoSrc,
    poster: item.poster,
    tracks: item.caption
  }
}

function imageMedia(name: string): FeatureRow['media'] {
  const template = templateFor(name)
  const src = template.thumbnails[0]
  if (!src) throw new Error(`Missing industry workflow thumbnail: ${name}`)
  return { type: 'image', src }
}

function workflowSlide(name: string): IndustryFeaturedWorkflow {
  const { template, href } = workflow(name)
  const media = imageMedia(name)
  return {
    title: template.title,
    href,
    media: media.src,
    mediaType: 'image',
    tags: [...template.tags],
    models: [...template.models]
  }
}

const advertisingHero = tutorial('ad_product_photography')
const filmHero = tutorial('animation_in_betweening')
const architectureHero = imageMedia('image_qwen_image_edit_2511')
const advertisingStory = getCustomerVideoStory('silverside-ai')

export const industryVerticals: Record<IndustryVerticalId, IndustryVertical> = {
  advertising: {
    id: 'advertising',
    keysPrefix: 'industry.advertising',
    badgeKey: 'industry.advertising.badge',
    storySlug: advertisingStory.slug,
    hero: {
      type: 'video',
      src: advertisingHero.videoSrc,
      poster: advertisingHero.poster,
      tracks: advertisingHero.caption
    },
    workflows: [
      'templates-product_scene_relight',
      'image_flux2_fp8',
      'templates-photo_to_product_vid',
      'utility_nanobanana_pro_product_upscale',
      'templates_rob_portrait_light_migration.app',
      'utility_birefnet_remove_background'
    ].map(workflow),
    featured: [
      workflowSlide('templates-product_scene_relight'),
      workflowSlide('templates-photo_to_product_vid'),
      workflowSlide('image_flux2_fp8')
    ],
    examples: [
      {
        id: 'moodboards',
        titleKey: 'industry.advertising.examples.moodboards.title',
        descriptionKey: 'industry.advertising.examples.moodboards.description',
        media: tutorialMedia('ad_moodboard_creation')
      },
      {
        id: 'products',
        titleKey: 'industry.advertising.examples.products.title',
        descriptionKey: 'industry.advertising.examples.products.description',
        media: tutorialMedia('ad_product_photography')
      },
      {
        id: 'broll',
        titleKey: 'industry.advertising.examples.broll.title',
        descriptionKey: 'industry.advertising.examples.broll.description',
        media: tutorialMedia('ad_broll_creation')
      }
    ]
  },
  'film-animation': {
    id: 'film-animation',
    keysPrefix: 'industry.film-animation',
    badgeKey: 'industry.film-animation.badge',
    hero: {
      type: 'video',
      src: filmHero.videoSrc,
      poster: filmHero.poster,
      tracks: filmHero.caption
    },
    workflows: [
      'templates-character_sheet',
      'video_minimax_h3_r2v',
      'template_ltx2_3_ic_lora_ingredients',
      'templates-qwen_multiangle.app',
      'utility_topaz_illustration_upscale',
      'video_wan_animate2'
    ].map(workflow),
    featured: [
      {
        title: templateFor('template_seedance2_storyboard_to_video').title,
        href: 'https://comfy.org/workflows/f4e29143100c-f4e29143100c/',
        media: imageMedia('template_seedance2_storyboard_to_video').src,
        mediaType: 'image',
        tags: ['Storyboarding'],
        models: ['Seedance']
      },
      workflowSlide('video_minimax_h3_r2v'),
      workflowSlide('templates-character_sheet')
    ],
    examples: [
      {
        id: 'characters',
        titleKey: 'industry.film-animation.examples.characters.title',
        descriptionKey:
          'industry.film-animation.examples.characters.description',
        media: tutorialMedia('animation_character_sheet')
      },
      {
        id: 'keyframes',
        titleKey: 'industry.film-animation.examples.keyframes.title',
        descriptionKey:
          'industry.film-animation.examples.keyframes.description',
        media: tutorialMedia('animation_keyframe_exploration')
      },
      {
        id: 'compositing',
        titleKey: 'industry.film-animation.examples.compositing.title',
        descriptionKey:
          'industry.film-animation.examples.compositing.description',
        media: tutorialMedia('animation_background_and_compositing')
      }
    ]
  },
  'architectural-visualization': {
    id: 'architectural-visualization',
    keysPrefix: 'industry.architectural-visualization',
    badgeKey: 'industry.architectural-visualization.badge',
    hero: {
      type: 'image',
      src: architectureHero.src,
      poster: architectureHero.src
    },
    workflows: [
      'image_qwen_image_edit_2511',
      'utility-topaz_landscape_upscaler',
      'templates-1_click_multiple_scene_angles-v1.0',
      'utility_depth_anything3_image_depth_estimation',
      'utility_moge_depth_estimation',
      'flux_fill_outpaint_example'
    ].map(cloudWorkflow),
    featured: [
      workflowSlide('image_qwen_image_edit_2511'),
      cloudWorkflowSlide('utility-topaz_landscape_upscaler'),
      cloudWorkflowSlide('templates-1_click_multiple_scene_angles-v1.0')
    ],
    examples: [
      {
        id: 'depth',
        titleKey: 'industry.architectural-visualization.examples.depth.title',
        descriptionKey:
          'industry.architectural-visualization.examples.depth.description',
        media: imageMedia('image_qwen_image_edit_2511')
      },
      {
        id: 'lighting',
        titleKey:
          'industry.architectural-visualization.examples.lighting.title',
        descriptionKey:
          'industry.architectural-visualization.examples.lighting.description',
        media: imageMedia('utility-topaz_landscape_upscaler')
      },
      {
        id: 'angles',
        titleKey: 'industry.architectural-visualization.examples.angles.title',
        descriptionKey:
          'industry.architectural-visualization.examples.angles.description',
        media: imageMedia('templates-1_click_multiple_scene_angles-v1.0')
      }
    ]
  }
}

export function getIndustryVertical(id: IndustryVerticalId): IndustryVertical {
  return industryVerticals[id]
}
