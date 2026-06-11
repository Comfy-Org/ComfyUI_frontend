import type { LearningTutorial } from '../content.config'

const DEFAULT_POSTER_TIME_SECONDS = 1

export const getTutorialPosterSrc = (tutorial: LearningTutorial): string =>
  tutorial.poster
    ? tutorial.poster
    : `${tutorial.videoSrc}#t=${tutorial.posterTime ?? DEFAULT_POSTER_TIME_SECONDS}`
