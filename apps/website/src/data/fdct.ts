import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

export interface FdctPageData {
  ctas: {
    contact: string
    enterpriseBand: string
    minimaxBand: string
  }
}

export interface FdctTechnologist {
  id: string
  name: string
  // Optional preferred first name for the "See {name}'s work" CTA when it
  // differs from the leading token of `name` (e.g. Robert Paige → "Bert").
  nickname?: string
  avatarSrc: string
  description: string
  tags?: readonly string[]
}

// Headshots live on the media CDN; bios, tag labels, and workflow
// descriptions resolve from translations.ts per locale.
const technologistIdentities = {
  'doug-hogan': {
    name: 'Doug Hogan',
    avatarSrc: 'https://media.comfy.org/website/technologists/doug-hogan_v2.png'
  },
  'chris-v': {
    name: 'Chris V.',
    avatarSrc: 'https://media.comfy.org/website/technologists/chris-v_v2.png'
  },
  'rob-losch': {
    name: 'Rob Losch',
    avatarSrc: 'https://media.comfy.org/website/technologists/rob-losch_v3.png'
  },
  'robert-paige': {
    name: 'Robert Paige',
    avatarSrc:
      'https://media.comfy.org/website/technologists/robert-paige_v4.png'
  }
} as const

export function technologists(
  locale: Locale = 'en'
): readonly FdctTechnologist[] {
  return [
    {
      id: 'doug-hogan',
      ...technologistIdentities['doug-hogan'],
      description: t('fdct.technologists.dougHogan.description', locale),
      tags: [
        t('fdct.tags.entertainment', locale),
        t('fdct.tags.nuke', locale),
        t('fdct.tags.vfx', locale)
      ]
    },
    {
      id: 'chris-v',
      ...technologistIdentities['chris-v'],
      description: t('fdct.technologists.chrisV.description', locale),
      tags: [
        t('fdct.tags.generativeAi', locale),
        t('fdct.tags.production', locale)
      ]
    },
    {
      id: 'rob-losch',
      ...technologistIdentities['rob-losch'],
      description: t('fdct.technologists.robLosch.description', locale),
      tags: [
        t('fdct.tags.marketing', locale),
        t('fdct.tags.advertising', locale)
      ]
    },
    {
      id: 'robert-paige',
      ...technologistIdentities['robert-paige'],
      // Design 10769:8658 shows no technologist-level tag badges for Robert;
      // his dialog leads straight from bio into the workflow cards.
      nickname: 'Bert',
      description: t('fdct.technologists.robertPaige.description', locale)
    }
  ]
}

type FdctProjectCategory = 'advertisement' | 'entertainment' | 'ecommerce'

export interface FdctProject {
  id: string
  title: string
  category: FdctProjectCategory
  media: { type: 'image' | 'video'; src: string; poster?: string }
  author: { name: string; avatarSrc: string }
  href: string
  // Shown on the technologist-dialog cards; resolves from translations.ts.
  description?: string
  tags: readonly string[]
}

// Top workflows from each technologist's hub page (most-popular order);
// cover videos are the hub's own preview assets. Chris's picks land once
// his hub page link is provided.
export function projects(locale: Locale = 'en'): readonly FdctProject[] {
  return [
    {
      id: 'product-advertisement-video',
      title: t('fdct.projects.productAdvertisementVideo.title', locale),
      category: 'advertisement',
      media: {
        type: 'video',
        src: 'https://comfy-hub-assets.comfy.org/uploads/a8c26beb-d463-40a0-8547-fa942e53ad70.mp4'
      },
      author: technologistIdentities['rob-losch'],
      href: 'https://comfy.org/workflows/c98e5c457e1e-c98e5c457e1e/',
      description: t(
        'fdct.projects.productAdvertisementVideo.description',
        locale
      ),
      tags: [
        t('fdct.tags.imageGeneration', locale),
        t('fdct.tags.imageToVideo', locale)
      ]
    },
    {
      id: 'ltx-cleanplate-for-vfx',
      title: t('fdct.projects.ltxCleanplateForVfx.title', locale),
      category: 'entertainment',
      media: {
        type: 'video',
        src: 'https://comfy-hub-assets.comfy.org/uploads/8a3a846f-5017-428e-b2a2-24025c55e884.mp4'
      },
      author: technologistIdentities['doug-hogan'],
      href: 'https://comfy.org/workflows/8f2cf0df5da6-8f2cf0df5da6/',
      description: t('fdct.projects.ltxCleanplateForVfx.description', locale),
      tags: [t('fdct.tags.vfx', locale)]
    },
    {
      id: 'lipdub-lora-voice-clone',
      title: t('fdct.projects.lipdubLoraVoiceClone.title', locale),
      category: 'entertainment',
      media: {
        type: 'video',
        src: 'https://comfy-hub-assets.comfy.org/uploads/dfd1e800-d2d8-4ca9-b624-f4158e694785.mp4'
      },
      author: technologistIdentities['rob-losch'],
      href: 'https://comfy.org/workflows/e4ab88456b9b-e4ab88456b9b/',
      description: t('fdct.projects.lipdubLoraVoiceClone.description', locale),
      tags: [
        t('fdct.tags.imageGeneration', locale),
        t('fdct.tags.audioEditing', locale)
      ]
    },
    {
      id: 'vfx-utilities',
      title: t('fdct.projects.vfxUtilities.title', locale),
      category: 'entertainment',
      media: {
        type: 'video',
        src: 'https://comfy-hub-assets.comfy.org/uploads/fd38a7e9-0d2a-4d6a-9d6a-b04bbce294cc.mp4'
      },
      author: technologistIdentities['doug-hogan'],
      href: 'https://comfy.org/workflows/be0889296f65-be0889296f65/',
      description: t('fdct.projects.vfxUtilities.description', locale),
      tags: [
        t('fdct.tags.imageGeneration', locale),
        t('fdct.tags.video', locale)
      ]
    },
    {
      id: 'viral-videos-character-swap',
      title: t('fdct.projects.viralVideosCharacterSwap.title', locale),
      category: 'entertainment',
      media: {
        type: 'video',
        src: 'https://comfy-hub-assets.comfy.org/uploads/61c7358d-96f5-49e2-81f5-4991d461ed1c.mp4'
      },
      author: technologistIdentities['rob-losch'],
      href: 'https://comfy.org/workflows/064da31db8f3-064da31db8f3/',
      description: t(
        'fdct.projects.viralVideosCharacterSwap.description',
        locale
      ),
      tags: [
        t('fdct.tags.imageGeneration', locale),
        t('fdct.tags.characterReference', locale)
      ]
    },
    {
      id: 'face-swap-workflow',
      title: t('fdct.projects.faceSwapWorkflow.title', locale),
      category: 'entertainment',
      media: {
        type: 'video',
        src: 'https://comfy-hub-assets.comfy.org/uploads/d0bc92f7-c5dc-4861-9588-5ae94b609c6d.mp4'
      },
      author: technologistIdentities['doug-hogan'],
      href: 'https://comfy.org/workflows/93f286fbc2c8-93f286fbc2c8/',
      description: t('fdct.projects.faceSwapWorkflow.description', locale),
      tags: [t('fdct.tags.vfx', locale)]
    },
    // Chris's highlighted hub picks (2026-08-10). The hub lists other
    // creators on these workflows; author here only routes them into his
    // dialog, which no longer displays a creator.
    {
      id: 'virtual-try-on-4-in-1',
      title: t('fdct.projects.virtualTryOn4In1.title', locale),
      category: 'ecommerce',
      media: {
        type: 'image',
        src: 'https://comfy-hub-assets.comfy.org/templates/d667542c-fa26-4fb7-bbdd-1bf85738f518.png'
      },
      author: technologistIdentities['chris-v'],
      href: 'https://comfy.org/workflows/templates_rob_fashion_shoot_vton-4in1.app-d7677ac50371/',
      description: t('fdct.projects.virtualTryOn4In1.description', locale),
      tags: [
        t('fdct.tags.imageGeneration', locale),
        t('fdct.tags.virtualTryOn', locale)
      ]
    },
    {
      id: 'character-outfit-fashion-video',
      title: t('fdct.projects.characterOutfitFashionVideo.title', locale),
      category: 'ecommerce',
      media: {
        type: 'video',
        src: 'https://comfy-hub-assets.comfy.org/templates/f022c5ad-2888-483c-bace-96f8a1d71f88.mp4'
      },
      author: technologistIdentities['chris-v'],
      href: 'https://comfy.org/workflows/templates-stitched_vid_contact_sheet-2cf9f9f6d205/',
      description: t(
        'fdct.projects.characterOutfitFashionVideo.description',
        locale
      ),
      tags: [
        t('fdct.tags.fashion', locale),
        t('fdct.tags.imageToVideo', locale)
      ]
    },
    {
      id: 'talent-casting',
      title: t('fdct.projects.talentCasting.title', locale),
      category: 'advertisement',
      media: {
        type: 'video',
        src: 'https://comfy-hub-assets.comfy.org/uploads/12b14df7-4838-49a0-95df-54371cdaa9ae.mp4'
      },
      author: technologistIdentities['chris-v'],
      href: 'https://comfy.org/workflows/ff88e6723334-ff88e6723334/',
      description: t('fdct.projects.talentCasting.description', locale),
      tags: [
        t('fdct.tags.imageToVideo', locale),
        t('fdct.tags.characterReference', locale)
      ]
    },
    // Robert Paige's highlighted workflows from the Comfy workflows hub. The
    // hub lists other creators on these workflows; author here only routes
    // them into his dialog, which no longer displays a creator. Cover media
    // are each workflow's own hub thumbnail.
    {
      id: 'seedance-llm-prompt-helper',
      title: t('fdct.projects.seedanceLlmPromptHelper.title', locale),
      category: 'advertisement',
      media: {
        type: 'video',
        src: 'https://comfy-hub-assets.comfy.org/uploads/2d8e756e-adbf-4114-bae8-0e84154a84ad.mp4'
      },
      author: technologistIdentities['robert-paige'],
      href: 'https://comfy.org/workflows/49a2f3a0811f-49a2f3a0811f/',
      description: t(
        'fdct.projects.seedanceLlmPromptHelper.description',
        locale
      ),
      tags: [t('fdct.tags.imageToVideo', locale), t('fdct.tags.video', locale)]
    },
    {
      id: 'nano-banana-2-lite-image-edit',
      title: t('fdct.projects.nanoBanana2LiteImageEdit.title', locale),
      category: 'advertisement',
      media: {
        type: 'image',
        src: 'https://comfy-hub-assets.comfy.org/uploads/872caa07-74d9-4d3a-b937-e001b06a02ed.png'
      },
      author: technologistIdentities['robert-paige'],
      href: 'https://comfy.org/workflows/62cb2b168265-62cb2b168265/',
      description: t(
        'fdct.projects.nanoBanana2LiteImageEdit.description',
        locale
      ),
      tags: [
        t('fdct.tags.imageGeneration', locale),
        t('fdct.tags.imageEdit', locale)
      ]
    },
    {
      id: 'change-any-objects',
      title: t('fdct.projects.changeAnyObjects.title', locale),
      category: 'advertisement',
      media: {
        type: 'video',
        src: 'https://comfy-hub-assets.comfy.org/templates/69636d20-6aff-4b1a-a8ad-71f456fc8738.mp4'
      },
      author: technologistIdentities['robert-paige'],
      href: 'https://comfy.org/workflows/templates_shane_change_any_objects-cf84f066d9dd/',
      description: t('fdct.projects.changeAnyObjects.description', locale),
      tags: [
        t('fdct.tags.imageGeneration', locale),
        t('fdct.tags.inpainting', locale)
      ]
    }
  ]
}

export interface FdctFeaturedProject {
  id: string
  title: string
  media: { type: 'image' | 'video'; src: string; poster?: string }
  tags: readonly string[]
}

// The "Featured projects" grid is a standalone, curated set of workflows from
// the Comfy hub, independent of the technologist dialogs. Titles and cover
// assets come from each workflow's own hub page; order and tag labels match
// the design (10331:36004). The cards deliberately carry no workflow links.
export function featuredProjects(
  locale: Locale = 'en'
): readonly FdctFeaturedProject[] {
  return [
    {
      id: 'product-advertisement-video',
      title: t('fdct.projects.productAdvertisementVideo.title', locale),
      media: {
        type: 'video',
        src: 'https://comfy-hub-assets.comfy.org/uploads/a8c26beb-d463-40a0-8547-fa942e53ad70.mp4'
      },
      tags: [t('fdct.tags.advertising', locale)]
    },
    {
      id: 'storyboard-to-video-seedance',
      title: t('fdct.projects.storyboardToVideoSeedance.title', locale),
      media: {
        type: 'video',
        src: 'https://comfy-hub-assets.comfy.org/uploads/34ea9f1a-1aac-4c6f-af48-b88cf154ec9b.mp4'
      },
      tags: [t('fdct.tags.advertising', locale), t('fdct.tags.film', locale)]
    },
    {
      id: 'ooh-visualization',
      title: t('fdct.projects.oohVisualization.title', locale),
      media: {
        type: 'image',
        src: 'https://comfy-hub-assets.comfy.org/uploads/dbb9b751-2f86-49b6-a2e5-81c9afb1322e.png'
      },
      tags: [t('fdct.tags.advertising', locale)]
    },
    {
      id: 'face-swap-workflow',
      title: t('fdct.projects.faceSwapWorkflow.title', locale),
      media: {
        type: 'video',
        src: 'https://comfy-hub-assets.comfy.org/uploads/d0bc92f7-c5dc-4861-9588-5ae94b609c6d.mp4'
      },
      tags: [t('fdct.tags.vfx', locale)]
    },
    {
      id: 'photo-to-blueprint-to-model',
      title: t('fdct.projects.photoToBlueprintToModel.title', locale),
      media: {
        type: 'image',
        src: 'https://comfy-hub-assets.comfy.org/templates/a4700cc0-72ea-409e-9693-34a6d26a8c96.webp'
      },
      tags: [t('fdct.tags.architecture', locale)]
    },
    {
      id: 'generate-realistic-variations',
      title: t('fdct.projects.generateRealisticVariations.title', locale),
      media: {
        type: 'video',
        src: 'https://comfy-hub-assets.comfy.org/templates/e0802269-6a96-4309-83b9-3dff1dc59a10.mp4'
      },
      tags: [t('fdct.tags.advertising', locale)]
    }
  ]
}

const faqNumbers = [1, 2, 3, 4, 5] as const

// One source for both the rendered Q&A section and the FAQPage json-ld node,
// so the structured data always matches the on-page copy per locale.
export function fdctFaqs(locale: Locale) {
  return faqNumbers.map((n) => ({
    id: String(n),
    question: t(`fdct.faq.q${n}`, locale),
    answer: t(`fdct.faq.a${n}`, locale)
  }))
}

export const fdctPage: FdctPageData = {
  ctas: {
    contact: '/contact',
    enterpriseBand: '/contact',
    minimaxBand: '/minimax/license'
  }
}
