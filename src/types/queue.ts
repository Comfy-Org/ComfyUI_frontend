/**
 * Job execution state used across queue UI components.
 */
export type JobState =
  | 'added'
  | 'queued'
  | 'initialization'
  | 'running'
  | 'completed'
  | 'failed'
