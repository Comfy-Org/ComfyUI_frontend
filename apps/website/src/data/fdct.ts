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
  description: string
  avatarSrc: string
}

// FPO placeholders; real technologists swap in via a follow-up data-only PR.
export const technologists: readonly FdctTechnologist[] = [
  {
    id: 'placeholder-1',
    name: 'FDCT Placeholder One',
    description:
      'Feature film background, with ComfyUI on the back end of shipped work.',
    avatarSrc: '/assets/images/fallback-gradient-avatar.svg'
  },
  {
    id: 'placeholder-2',
    name: 'FDCT Placeholder Two',
    description: 'Commercial production, from pitch through final delivery.',
    avatarSrc: '/assets/images/fallback-gradient-avatar.svg'
  },
  {
    id: 'placeholder-3',
    name: 'FDCT Placeholder Three',
    description:
      'Experiential and installation work built on production pipelines.',
    avatarSrc: '/assets/images/fallback-gradient-avatar.svg'
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
