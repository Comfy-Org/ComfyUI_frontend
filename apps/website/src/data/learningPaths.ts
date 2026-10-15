import type { LearningCategory, LearningTutorial } from './learningTutorials'

/** Canonical path for a category's directory page (wrap with localizeHref for zh-CN). */
export const categoryPath = (category: LearningCategory): string =>
  `/learning/${category}/`

/** Canonical path for a tutorial's detail page (wrap with localizeHref for zh-CN). */
export const tutorialPath = (tutorial: LearningTutorial): string =>
  `${categoryPath(tutorial.category)}${tutorial.slug}/`
