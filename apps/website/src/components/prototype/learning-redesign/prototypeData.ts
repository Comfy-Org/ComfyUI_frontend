// PROTOTYPE — throwaway data layer for the /learning redesign prototype.
// Assigns each existing tutorial a category (vfx | animations | ads) and picks
// a featured item. In production the category would live on LearningTutorial
// itself and drive /learning/vfx-style routes; here it's bolted on so the
// variants have something real to filter.
import type { LearningTutorial } from '../../../data/learningTutorials'

import { learningTutorials } from '../../../data/learningTutorials'

type LearningCategory = 'vfx' | 'animations' | 'ads'
export type CategoryFilter = 'all' | LearningCategory

export type PrototypeTutorial = LearningTutorial & {
  category: LearningCategory
}

// PROTOTYPE guesses — the real assignment is a content decision.
const categoryById: Record<string, LearningCategory> = {
  cleanplate_walkthrough_v03: 'vfx',
  deaging_workflow_v03: 'animations',
  frame_adjustments_demo_v03: 'animations',
  mattes_and_utilities_v03: 'vfx',
  seedance_demo_comfyui_v03: 'ads',
  skyreplacement_smaller_v06: 'vfx'
}

const prototypeTutorials: readonly PrototypeTutorial[] = learningTutorials.map(
  (tutorial) => ({
    ...tutorial,
    category: categoryById[tutorial.id] ?? 'vfx'
  })
)

// Same tutorial the current FeaturedWorkflowSection showcases.
const FEATURED_ID = 'skyreplacement_smaller_v06'

interface CategoryOption {
  value: CategoryFilter
  label: string
  blurb: string
}

export const categoryOptions: readonly CategoryOption[] = [
  { value: 'all', label: 'All', blurb: 'Every tutorial and workflow' },
  { value: 'vfx', label: 'VFX', blurb: 'Compositing, cleanup and shot work' },
  {
    value: 'animations',
    label: 'Animations',
    blurb: 'Motion, retiming and character'
  },
  { value: 'ads', label: 'Ads', blurb: 'Product shots and campaign assets' }
]

export const realCategories = categoryOptions.filter(
  (option): option is CategoryOption & { value: LearningCategory } =>
    option.value !== 'all'
)

export const categoryLabel = (category: LearningCategory): string =>
  realCategories.find((option) => option.value === category)?.label ?? category

export const filterByCategory = (
  category: CategoryFilter
): readonly PrototypeTutorial[] =>
  category === 'all'
    ? prototypeTutorials
    : prototypeTutorials.filter((tutorial) => tutorial.category === category)

/** Featured item for the current filter — the global pick when visible, else the category's first. */
export const featuredFor = (category: CategoryFilter): PrototypeTutorial => {
  const pool = filterByCategory(category)
  return pool.find((tutorial) => tutorial.id === FEATURED_ID) ?? pool[0]
}
