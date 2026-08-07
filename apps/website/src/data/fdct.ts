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
// CDN; workflowsHref is a placeholder until per-person workflow pages exist.
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
    workflowsHref: '#'
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
    ],
    workflowsHref: '#'
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
    workflowsHref: '#'
  }
]

export const fdctPage: FdctPageData = {
  ctas: {
    contact: '/contact',
    // Placeholder until the FDCT role exists; repoint (likely to an Ashby
    // posting) in a follow-up PR.
    applyFdct: '#',
    enterpriseBand: '/contact',
    creatorsBand: '/careers'
  }
}
