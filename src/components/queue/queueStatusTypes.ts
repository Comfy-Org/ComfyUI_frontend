import type { JobListItem } from '@/composables/queue/useJobList'

/**
 * Which limit keeps a queued job from starting. `plan` is the user's or
 * workspace's concurrent-job cap, `partner` the per-user partner-node gate,
 * `provider` a partner provider's own rate limit.
 */
export type HeldReason = 'plan' | 'partner' | 'provider'

export type JobView = {
  id: string
  title: string
  /**
   * `held` is a queued job a limit is holding back; `failed` stays in the
   * list while the rest of the batch keeps running.
   */
  status: 'running' | 'queued' | 'held' | 'failed'
  progress: number
  queuePosition: number
  heldBy?: HeldReason
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
