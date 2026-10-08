import type { FastLaneConfig } from './types.ts'

export const lanes: FastLaneConfig[] = [
  {
    id: 'website',
    pathPrefixes: ['apps/website/'],
    approval: {
      identity: 'christian-byrne',
      trustedAuthors: ['bertfy'],
      approvalLabel: 'website-fast-lane:approve',
      trustedLabelers: ['christian-byrne', 'drjkl', 'benjcooley'],
      holdLabel: 'website-fast-lane:hold'
    }
  }
]
