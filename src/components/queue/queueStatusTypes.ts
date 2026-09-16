import type { JobListItem } from '@/composables/queue/useJobList'

export type JobView = {
  id: string
  title: string
  status: 'running' | 'queued'
  progress: number
  queuePosition: number
}

export type TerminalKind = 'completed' | 'cancelled' | 'failed'

export type RecentResult = {
  id: string
  job: JobListItem
  name: string
  meta: string
  thumbSrc?: string
  isVideo: boolean
}
