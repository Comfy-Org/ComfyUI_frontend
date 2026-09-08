import type { UseCase } from './workshop'

// Text, 3D and audio each hold only a handful of models, so the catalogue groups
// them together as "other formats" rather than as three near-empty rows.
export const OTHER_FORMAT_USE_CASES: readonly UseCase[] = [
  'text',
  '3d',
  'audio'
]
