import { z } from 'zod'

const STORAGE_KEY = 'Comfy.QueueStatus.Jobs'
const MAX_REMEMBERED_JOBS = 50

const zRememberedJob = z.object({
  name: z.string().optional(),
  startedAt: z.number().optional()
})

const zJobMemory = z.record(z.string(), zRememberedJob)

export type RememberedJob = z.infer<typeof zRememberedJob>
export type JobMemory = Record<string, RememberedJob>

function sessionStore(): Storage | undefined {
  try {
    return window.sessionStorage
  } catch {
    return undefined
  }
}

export function readJobMemory(storage = sessionStore()): JobMemory {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = zJobMemory.safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

export function writeJobMemory(
  memory: JobMemory,
  storage = sessionStore()
): void {
  const newest = Object.entries(memory).slice(-MAX_REMEMBERED_JOBS)
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(newest)))
  } catch {
    return
  }
}

export function resolveJobStart({
  serverStart,
  rememberedStart,
  now
}: {
  serverStart?: number
  rememberedStart?: number
  now: number
}): number {
  return serverStart ?? rememberedStart ?? now
}
