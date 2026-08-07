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
  bio: readonly string[]
  workflowsHref?: string
}

// Bios are verbatim from the FDCT page design. Headshots live on the media
// CDN. Chris has no workflowsHref until his hub page link is provided; the
// dialog omits its CTA for profiles without one.
export const technologists: readonly FdctTechnologist[] = [
  {
    id: 'doug-hogan',
    name: 'Doug Hogan',
    avatarSrc: 'https://media.comfy.org/website/technologists/doug-hogan.png',
    bio: [
      "Doug is a Creative Technologist, VFX Supervisor, and educator who has spent his career in the messy middle where the creative team knows what they want but the pipeline doesn't yet know how to build it. His credits include The Book of Life, SCOOB!, and Netflix's Thelma the Unicorn, plus work for Universal Studios, Warner Bros., Netflix, and Samsung. He studied Visual Effects and Film & Television at Savannah College of Art and Design, then spent much of his career at Reel FX, eventually supervising compositing and matte painting teams.",
      "That artist-engineer combination pulled him into AI and creative technology. At xAI, he worked on the Human Data team, training and evaluating frontier AI systems from a working artist's perspective. At Groove Jones, he built AI, VFX, real-time, and interactive pipelines for experiential projects, including ComfyUI-powered generative systems and AI experiences for the NCAA, Bandai Namco, and the US Army. He also works with brands like Amazon, Asteria, Crocs, and Apple, using generative techniques to hit high-end results in hybrid pipelines while keeping artists in control.",
      'Today Doug is a Forward Deployed Creative Technologist at Comfy, plugging ComfyUI directly into VFX and studio production pipelines: figuring out what new models can do, building workflows around them, and translating that into tools artists can use without losing control.',
      "He's also a longtime Nuke compositor and pipeline builder, writing Python-based tools and training ML models to automate repetitive work. He teaches VFX, Nuke, and generative AI through fxphd, ActionVFX, and other platforms. It's a tool!"
    ],
    workflowsHref: 'https://comfy.org/workflows/doughogan/'
  },
  {
    id: 'chris-v',
    name: 'Chris V.',
    avatarSrc: 'https://media.comfy.org/website/technologists/chris-v.png',
    bio: [
      'A successful generative AI project requires more than a strong output. It requires the engineering, infrastructure, and creative judgment to produce that output consistently. Chris Vespaziani has built his career bringing those pieces together for projects where deadlines are fixed and failure is visible.',
      'A Forward Deployed Technical Creative at Comfy, Chris works across generative AI, creative technology, software development, and production infrastructure. His background sits between artist and engineer, combining visual direction with the ability to build the systems required to deliver reliably. His commercial work has supported global brands and multi-platinum recording artists, and appeared on Fortune 500 keynote stages and the Las Vegas Strip.',
      'Before joining Comfy, Chris spent four years architecting custom VFX, animation, and generative AI pipelines for studios and Creative Directors, extending into the underlying engineering: custom Python tools, ComfyUI nodes, backend services, model integrations, and full-stack production platforms built from the ground up.',
      "That combination lets him work across the entire production chain, shaping the creative approach, evaluating models, designing the workflow, writing the tooling, and carrying the system through deployment. A pipeline that stops before the last mile isn't a pipeline you actually control."
    ]
  },
  {
    id: 'rob-losch',
    name: 'Rob Losch',
    avatarSrc: 'https://media.comfy.org/website/technologists/rob-losch.png',
    bio: [
      "Rob has been in ComfyUI since day one. If you've used an in-app template since, chances are you've used one of his.",
      "A Creative Technologist at Comfy who came looking for a creative outlet at the intersection of art and technology and stayed for the node graph — and the complexity that comes with it. Taking nodes apart to see what they actually do, training LoRAs, stitching it all into something that runs, then the harder part: making it legible to someone who's never opened ComfyUI. Same instinct he brings to any problem. Take the tangle, find the shape, hand back something clean. No spaghetti.",
      "He's tested every model worth testing, most of them the week they dropped, and can tell you where each one breaks. Which one holds a face across a cut. Which one collapses on hands, or text, or motion, or anything past four seconds. That knowledge is the difference between a workflow that produces one good frame and a workflow a team can run on a deadline — model selection is the first creative decision, not a technical footnote.",
      'The work skews marketing and advertising, and it starts where the brief starts — with the aesthetic. Look first. Then the graph that reproduces it. Then the version that runs a hundred times without him in the room. A one-off becomes a workflow; a workflow becomes an automation engine a creative team can point at a campaign.',
      'The experimental side is the point, and so is sharing it. Nothing he learns in private gets to stay there.'
    ],
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
    href: 'https://comfy.org/workflows/c98e5c457e1e-c98e5c457e1e/'
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
    href: 'https://comfy.org/workflows/8f2cf0df5da6-8f2cf0df5da6/'
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
    href: 'https://comfy.org/workflows/e4ab88456b9b-e4ab88456b9b/'
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
    href: 'https://comfy.org/workflows/be0889296f65-be0889296f65/'
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
    href: 'https://comfy.org/workflows/064da31db8f3-064da31db8f3/'
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
    href: 'https://comfy.org/workflows/7dca0438edf4-7dca0438edf4/'
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
