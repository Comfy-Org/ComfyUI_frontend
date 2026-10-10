/**
 * The feed: one row per prompt, with a slot for each image it asked for. A
 * slot is developing, done or failed, and keeps what its tile needs to show.
 */
import type { DarkroomFailure } from './failure'
import type { DarkroomImageInput, DarkroomRequest } from './request'
import type { DarkroomItem, DarkroomPending } from './store'

type SlotPhase = 'sending' | 'queued' | 'running' | 'saving'

interface SlotBase {
  /** Stable within the page, for list keys. */
  readonly key: string
  readonly run: number
  readonly seed: number
}

export interface PendingSlot extends SlotBase {
  readonly status: 'pending'
  readonly phase: SlotPhase
  /** Requests ahead of this one in Router's line. */
  readonly ahead?: number
  /** When it started developing, for the elapsed count. */
  readonly startedAt: number
  readonly requestId?: string
}

export interface DoneSlot extends SlotBase {
  readonly status: 'done'
  readonly item: DarkroomItem
  /** True when it finished on this visit, so the tile fades in. */
  readonly fresh?: boolean
}

interface FailedSlot extends SlotBase {
  readonly status: 'error'
  readonly failure: DarkroomFailure
  readonly detail: string
  readonly cancelled?: boolean
}

export type DarkroomSlot = PendingSlot | DoneSlot | FailedSlot

export interface DarkroomJob {
  readonly jobId: string
  readonly settings: DarkroomRequest
  /** Milliseconds since the epoch. */
  readonly created: number
  readonly slots: readonly DarkroomSlot[]
  /**
   * The references this row was made from. Present only for rows started on
   * this visit: their data is not saved, so an older row cannot be re-run
   * with them.
   */
  readonly references?: readonly DarkroomReference[]
}

/** A reference image waiting in the prompt bar, or remembered by a row. */
export interface DarkroomReference extends DarkroomImageInput {
  readonly name: string
  /** A `data:` or `blob:` address for the thumbnail. */
  readonly url: string
}

function slotKey(jobId: string, run: number): string {
  return `${jobId}:${run}`
}

export function pendingSlot(
  jobId: string,
  run: number,
  seed: number,
  now = Date.now()
): PendingSlot {
  return {
    key: slotKey(jobId, run),
    run,
    seed,
    status: 'pending',
    phase: 'sending',
    startedAt: now
  }
}

/**
 * Rebuilds the feed from what is stored: saved images grouped into rows by
 * `jobId`, plus the requests Router still holds, which rejoin their rows so a
 * reload does not lose images in progress.
 */
export function jobsFromStore(
  items: readonly DarkroomItem[],
  pending: readonly DarkroomPending[]
): DarkroomJob[] {
  const jobs = new Map<
    string,
    { settings: DarkroomRequest; created: number; slots: DarkroomSlot[] }
  >()
  const rowFor = (settings: DarkroomRequest, created: number) => {
    const row = jobs.get(settings.jobId) ?? { settings, created, slots: [] }
    row.created = Math.min(row.created, created)
    jobs.set(settings.jobId, row)
    return row
  }
  for (const item of items) {
    rowFor(item.settings, item.created).slots.push({
      key: slotKey(item.settings.jobId, item.settings.run),
      run: item.settings.run,
      seed: item.settings.seed,
      status: 'done',
      item
    })
  }
  for (const request of pending) {
    const row = rowFor(request.settings, request.created)
    if (row.slots.some((slot) => slot.run === request.settings.run)) continue
    row.slots.push({
      ...pendingSlot(
        request.settings.jobId,
        request.settings.run,
        request.settings.seed,
        request.created
      ),
      phase: 'queued',
      requestId: request.requestId
    })
  }
  return [...jobs.entries()]
    .map(([jobId, row]) => {
      const slots = [...row.slots].sort((a, b) => a.run - b.run)
      return {
        jobId,
        // A row shows the seed its first image used.
        settings: { ...row.settings, run: 0, seed: slots[0].seed },
        created: row.created,
        slots
      }
    })
    .sort((a, b) => b.created - a.created)
}

export function isPending(slot: DarkroomSlot): slot is PendingSlot {
  return slot.status === 'pending'
}

export function isDone(slot: DarkroomSlot): slot is DoneSlot {
  return slot.status === 'done'
}

export function doneSlots(jobs: readonly DarkroomJob[]): DoneSlot[] {
  return jobs.flatMap((job) => job.slots.filter(isDone))
}

export function pendingCount(jobs: readonly DarkroomJob[]): number {
  return jobs.reduce(
    (count, job) => count + job.slots.filter(isPending).length,
    0
  )
}

/** Replaces one slot, leaving every other row and slot object untouched. */
export function withSlot(
  jobs: readonly DarkroomJob[],
  key: string,
  change: (slot: DarkroomSlot) => DarkroomSlot
): DarkroomJob[] {
  return jobs.map((job) =>
    job.slots.some((slot) => slot.key === key)
      ? {
          ...job,
          slots: job.slots.map((slot) =>
            slot.key === key ? change(slot) : slot
          )
        }
      : job
  )
}

/**
 * Drops deleted images from the feed. A row keeps its other images; a row
 * left with nothing but failed tiles goes away.
 */
export function withoutItems(
  jobs: readonly DarkroomJob[],
  gone: ReadonlySet<string>
): DarkroomJob[] {
  return jobs.flatMap((job) => {
    const slots = job.slots.filter(
      (slot) => !(isDone(slot) && gone.has(slot.item.id))
    )
    if (slots.length === job.slots.length) return [job]
    return slots.some((slot) => slot.status !== 'error')
      ? [{ ...job, slots }]
      : []
  })
}

/** Earlier prompts, newest first and without repeats, for ↑ and ↓. */
export function promptHistory(jobs: readonly DarkroomJob[]): string[] {
  return [...new Set(jobs.map((job) => job.settings.prompt).filter(Boolean))]
}

/**
 * A download name from the prompt and seed, like `fox-reading-a-map_s1234.png`,
 * instead of the id the image is stored under.
 */
export function downloadName(item: DarkroomItem): string {
  const slug =
    item.settings.prompt
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .split(/[\s-]+/)
      .slice(0, 6)
      .join('-')
      .slice(0, 48)
      .replace(/-+$/, '') || 'darkroom'
  const extension = item.mime.includes('jpeg') ? '.jpg' : '.png'
  return `${slug}_s${item.settings.seed}${extension}`
}

/** Images made and tokens used, today and in total. */
export function usageSummary(
  jobs: readonly DarkroomJob[],
  now = new Date()
): {
  readonly todayImages: number
  readonly todayTokens: number
  readonly totalTokens: number
} {
  const dayStart = new Date(now).setHours(0, 0, 0, 0)
  const items = doneSlots(jobs).map((slot) => slot.item)
  const tokens = (list: readonly DarkroomItem[]) =>
    list.reduce((sum, item) => sum + (item.stats.totalTokens ?? 0), 0)
  const today = items.filter((item) => item.created >= dayStart)
  return {
    todayImages: today.length,
    todayTokens: tokens(today),
    totalTokens: tokens(items)
  }
}

export function formatTokens(count: number): string {
  if (count >= 1e6) return `${(count / 1e6).toFixed(1)}M`
  if (count >= 1e3) return `${(count / 1e3).toFixed(1)}k`
  return String(count)
}
