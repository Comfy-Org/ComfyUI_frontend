export interface FdctPageData {
  ctas: {
    contact: string
    applyFdct: string
    enterpriseBand: string
    creatorsBand: string
  }
}

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
