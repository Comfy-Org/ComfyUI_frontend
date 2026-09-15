import type { UseCase } from './models-catalogue'

// Text, 3D and audio each hold a handful of models, so the catalogue shows them
// together as one "other formats" shelf rather than three near-empty rows.
export const OTHER_FORMAT_USE_CASES: readonly UseCase[] = [
  'text',
  '3d',
  'audio'
]
