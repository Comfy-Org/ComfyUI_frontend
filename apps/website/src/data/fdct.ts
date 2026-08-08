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

// Doug's description is verbatim from the FDCT dialog design; the others are
// condensed from the same bios the design shortened. Headshots live on the
// media CDN. Chris has no workflowsHref until his hub page link is provided;
// the dialog omits its CTA and workflow grid for profiles without one.
export const technologists: readonly FdctTechnologist[] = [
  {
    id: 'doug-hogan',
    name: 'Doug Hogan',
    avatarSrc: 'https://media.comfy.org/website/technologists/doug-hogan.png',
    description:
      "Doug is a Creative Technologist, VFX Supervisor, and educator who has spent his career in the messy middle where the creative team knows what they want but the pipeline doesn't yet know how to build it. He's also a longtime Nuke compositor and pipeline builder, writing Python-based tools and training ML models to automate repetitive work. He teaches VFX, Nuke, and generative AI through fxphd, ActionVFX, and other platforms. It's a tool!",
    workflowsHref: 'https://comfy.org/workflows/doughogan/'
  },
  {
    id: 'chris-v',
    name: 'Chris V.',
    avatarSrc: 'https://media.comfy.org/website/technologists/chris-v.png',
    description:
      'Chris Vespaziani is a Forward Deployed Technical Creative at Comfy, working across generative AI, creative technology, software development, and production infrastructure. His background sits between artist and engineer, combining visual direction with the ability to build the systems required to deliver reliably: custom Python tools, ComfyUI nodes, backend services, and full-stack production platforms built from the ground up.'
  },
  {
    id: 'rob-losch',
    name: 'Rob Losch',
    avatarSrc: 'https://media.comfy.org/website/technologists/rob-losch.png',
    description:
      "Rob has been in ComfyUI since day one — if you've used an in-app template since, chances are you've used one of his. A Creative Technologist at Comfy working at the intersection of art and technology, he's tested every model worth testing and knows where each one breaks, turning one-off experiments into workflows a creative team can run on a deadline.",
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
    id: 'adjustment-frame-workflow',
    title: 'Adjustment Frame Workflow',
    category: 'entertainment',
    media: {
      type: 'video',
      src: 'https://comfy-hub-assets.comfy.org/uploads/a643e6f2-f91e-450f-871c-4c99116193f0.mp4'
    },
    author: authorOf('doug-hogan'),
    href: 'https://comfy.org/workflows/7dca0438edf4-7dca0438edf4/',
    tags: ['Image Generation', 'Video']
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
