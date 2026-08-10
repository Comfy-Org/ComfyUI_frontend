import type { Locale } from '../i18n/translations'
import { t } from '../i18n/translations'

export interface FdctPageData {
  ctas: {
    contact: string
    applyFdct: string
    enterpriseBand: string
    creatorsBand: string
  }
}

export interface FdctTechnologist {
  id: string
  name: string
  avatarSrc: string
  description: string
  tags: readonly string[]
}

// Headshots live on the media CDN; bios, tag labels, and workflow
// descriptions resolve from translations.ts per locale. Doug's dialog tags
// come from the design; Chris's and Rob's are placeholders drawn from their
// bios until final copy lands.
const technologistIdentities = {
  'doug-hogan': {
    name: 'Doug Hogan',
    avatarSrc: 'https://media.comfy.org/website/technologists/doug-hogan.png'
  },
  'chris-v': {
    name: 'Chris V.',
    avatarSrc: 'https://media.comfy.org/website/technologists/chris-v.png'
  },
  'rob-losch': {
    name: 'Rob Losch',
    avatarSrc: 'https://media.comfy.org/website/technologists/rob-losch.png'
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
  // Shown on the technologist-dialog cards; placeholder copy until final
  // descriptions land (the design mock uses lorem ipsum here).
  description?: string
  tags: readonly string[]
  // Dialog highlights that are not past projects; the past-projects grid
  // filters these out.
  dialogOnly?: boolean
}

// Top workflows from each technologist's hub page (most-popular order);
// cover videos are the hub's own preview assets. Chris's picks land once
// his hub page link is provided.
export function projects(locale: Locale = 'en'): readonly FdctProject[] {
  return [
    {
      id: 'product-advertisement-video',
      title: 'Product Advertisement Video',
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
      title: 'LTX Cleanplate for VFX',
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
      title: 'LTX 2.3 - Lipdub LoRA + Voice Clone',
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
      title: 'VFX Utilities',
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
      title: 'Seedance 2.0 - Viral Videos Character Swap',
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
      title: 'Face Swap Workflow',
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
      title: 'Virtual Try On with Character - 4 in 1',
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
      ],
      dialogOnly: true
    },
    {
      id: 'character-outfit-fashion-video',
      title: 'Character & Outfit to Fashion Video',
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
      ],
      dialogOnly: true
    },
    {
      id: 'talent-casting',
      title: 'Talent Casting',
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
      ],
      dialogOnly: true
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
    applyFdct:
      'https://jobs.ashbyhq.com/comfy-org/b8faf3c0-a21c-4bed-8651-93daa6bfe81c',
    enterpriseBand: '/contact',
    creatorsBand: '/careers'
  }
}
