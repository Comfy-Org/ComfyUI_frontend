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
  workflowsHref?: string
}

// Descriptions are user-provided copy (2026-08-07). Headshots live on the
// media CDN. Chris has no workflowsHref until his hub page link is provided;
// the dialog omits its CTA and workflow grid for profiles without one.
export const technologists: readonly FdctTechnologist[] = [
  {
    id: 'doug-hogan',
    name: 'Doug Hogan',
    avatarSrc: 'https://media.comfy.org/website/technologists/doug-hogan.png',
    description:
      "Doug's work spans Netflix, Universal Studios, Warner Bros., and Samsung, with deep expertise in VFX and studio production. As a Nuke compositor and Python tool builder, he teaches VFX, Nuke, and generative AI.",
    workflowsHref: 'https://comfy.org/workflows/doughogan/'
  },
  {
    id: 'chris-v',
    name: 'Chris V.',
    avatarSrc: 'https://media.comfy.org/website/technologists/chris-v.png',
    description:
      "Chris's work spans global brands, artists, Fortune 500 keynote stages, and Art Basel Miami, with deep expertise in generative AI and production infrastructure. Sitting between artist and engineer, he architects custom VFX and AI pipelines."
  },
  {
    id: 'rob-losch',
    name: 'Rob Losch',
    avatarSrc: 'https://media.comfy.org/website/technologists/rob-losch.png',
    description:
      "Rob has been in ComfyUI since day one. He has numerous workflows covering marketing and advertising, and he can pinpoint the exact workflow you're looking for.",
    workflowsHref: 'https://comfy.org/workflows/hellorob/'
  }
]

type FdctProjectCategory = 'advertisement' | 'entertainment' | 'ecommerce'

export interface FdctProject {
  id: string
  title: string
  category: FdctProjectCategory
  media: { type: 'image' | 'video'; src: string; poster?: string }
  author: { name: string; avatarSrc: string }
  href: string
  tags: readonly string[]
}

function authorOf(personId: string) {
  const person = technologists.find(({ id }) => id === personId)
  if (!person) throw new Error(`Unknown technologist: ${personId}`)
  return { name: person.name, avatarSrc: person.avatarSrc }
}

// Top workflows from each technologist's hub page (most-popular order);
// cover videos are the hub's own preview assets. Chris's picks land once
// his hub page link is provided.
export const projects: readonly FdctProject[] = [
  {
    id: 'product-advertisement-video',
    title: 'Product Advertisement Video',
    category: 'advertisement',
    media: {
      type: 'video',
      src: 'https://comfy-hub-assets.comfy.org/uploads/a8c26beb-d463-40a0-8547-fa942e53ad70.mp4'
    },
    author: authorOf('rob-losch'),
    href: 'https://comfy.org/workflows/c98e5c457e1e-c98e5c457e1e/',
    tags: ['Image Generation', 'Image to Video']
  },
  {
    id: 'ltx-cleanplate-for-vfx',
    title: 'LTX Cleanplate for VFX',
    category: 'entertainment',
    media: {
      type: 'video',
      src: 'https://comfy-hub-assets.comfy.org/uploads/8a3a846f-5017-428e-b2a2-24025c55e884.mp4'
    },
    author: authorOf('doug-hogan'),
    href: 'https://comfy.org/workflows/8f2cf0df5da6-8f2cf0df5da6/',
    tags: []
  },
  {
    id: 'lipdub-lora-voice-clone',
    title: 'LTX 2.3 - Lipdub LoRA + Voice Clone',
    category: 'entertainment',
    media: {
      type: 'video',
      src: 'https://comfy-hub-assets.comfy.org/uploads/dfd1e800-d2d8-4ca9-b624-f4158e694785.mp4'
    },
    author: authorOf('rob-losch'),
    href: 'https://comfy.org/workflows/e4ab88456b9b-e4ab88456b9b/',
    tags: ['Image Generation', 'Audio Editing']
  },
  {
    id: 'vfx-utilities',
    title: 'VFX Utilities',
    category: 'entertainment',
    media: {
      type: 'video',
      src: 'https://comfy-hub-assets.comfy.org/uploads/fd38a7e9-0d2a-4d6a-9d6a-b04bbce294cc.mp4'
    },
    author: authorOf('doug-hogan'),
    href: 'https://comfy.org/workflows/be0889296f65-be0889296f65/',
    tags: ['Image Generation', 'Video']
  },
  {
    id: 'viral-videos-character-swap',
    title: 'Seedance 2.0 - Viral Videos Character Swap',
    category: 'entertainment',
    media: {
      type: 'video',
      src: 'https://comfy-hub-assets.comfy.org/uploads/61c7358d-96f5-49e2-81f5-4991d461ed1c.mp4'
    },
    author: authorOf('rob-losch'),
    href: 'https://comfy.org/workflows/064da31db8f3-064da31db8f3/',
    tags: ['Image Generation', 'Character Reference']
  },
  {
    id: 'face-swap-workflow',
    title: 'Face Swap Workflow',
    category: 'entertainment',
    media: {
      type: 'video',
      src: 'https://comfy-hub-assets.comfy.org/uploads/d0bc92f7-c5dc-4861-9588-5ae94b609c6d.mp4'
    },
    author: authorOf('doug-hogan'),
    href: 'https://comfy.org/workflows/93f286fbc2c8-93f286fbc2c8/',
    tags: []
  }
]

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
