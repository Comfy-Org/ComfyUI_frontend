const jobTabs = ['All', 'Completed', 'Failed'] as const
export type JobTab = (typeof jobTabs)[number]

export const jobTabLabelKeys: Record<JobTab, string> = {
  All: 'g.all',
  Completed: 'g.completed',
  Failed: 'g.failed'
}

export function getVisibleJobTabs(hasFailedJobs: boolean): readonly JobTab[] {
  return jobTabs.filter((tab) => hasFailedJobs || tab !== 'Failed')
}
