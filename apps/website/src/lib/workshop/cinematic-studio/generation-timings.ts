import type { InjectionKey, Ref } from 'vue'
import { z } from 'zod'

export const generationTimingNamespaceKey: InjectionKey<
  Readonly<Ref<string | undefined>>
> = Symbol('cinematic-generation-timing-namespace')
const MAX_AGE = 30 * 24 * 60 * 60 * 1000
const MAX_ELAPSED = 2 * 60 * 60 * 1000
const MAX_BYTES = 512 * 1024
const MAX_GAP = 5000
const sampleSchema = z
  .object({
    id: z.string().min(1).max(200),
    modelSlug: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-zA-Z0-9._-]+$/),
    elapsedMs: z.number().finite().positive().max(MAX_ELAPSED),
    completedAt: z.number().finite().nonnegative()
  })
  .strict()
type StoredSample = z.infer<typeof sampleSchema>
export type GenerationTimingSample = Readonly<Omit<StoredSample, 'modelSlug'>>
const storageSchema = z
  .object({ version: z.literal(1), samples: z.array(sampleSchema).max(1200) })
  .strict()

function key(namespace: string): string | undefined {
  if (!namespace || namespace === 'demo' || namespace.length > 1024) return
  return `comfy-cinema-generation-timings-v1:${encodeURIComponent(namespace)}`
}
function bounded(
  samples: readonly StoredSample[],
  now: number
): StoredSample[] {
  const seen = new Set<string>()
  const counts = new Map<string, number>()
  return [...samples]
    .sort((a, b) => b.completedAt - a.completedAt)
    .filter((sample) => {
      if (
        sample.completedAt < now - MAX_AGE ||
        sample.completedAt > now + 1000 ||
        seen.has(sample.id)
      )
        return false
      const count = counts.get(sample.modelSlug) ?? 0
      if (count >= 20 || (!count && counts.size >= 60)) return false
      seen.add(sample.id)
      counts.set(sample.modelSlug, count + 1)
      return true
    })
}
function read(namespace: string): StoredSample[] {
  try {
    const storageKey = key(namespace)
    if (!storageKey || typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(storageKey)
    if (!raw || raw.length > MAX_BYTES) return []
    const parsed = storageSchema.safeParse(JSON.parse(raw))
    return parsed.success ? bounded(parsed.data.samples, Date.now()) : []
  } catch {
    return []
  }
}
/** Browser observations include preparation, upload, queue and result collection. */
export function readGenerationTimings(
  namespace: string | undefined,
  modelSlug: string
): readonly GenerationTimingSample[] {
  return namespace
    ? read(namespace)
        .filter((sample) => sample.modelSlug === modelSlug)
        .map(({ id, elapsedMs, completedAt }) => ({
          id,
          elapsedMs,
          completedAt
        }))
    : []
}
/** Best-effort local statistics must never fail an otherwise successful generation. */
export function recordGenerationTiming(
  namespace: string,
  modelSlug: string,
  input: {
    id: string
    elapsedMs: number
    completedAt?: number
  }
): void {
  try {
    const storageKey = key(namespace)
    if (!storageKey || typeof localStorage === 'undefined') return
    const parsed = sampleSchema.safeParse({
      id: input.id,
      modelSlug,
      elapsedMs: input.elapsedMs,
      completedAt: input.completedAt ?? Date.now()
    })
    if (!parsed.success) return
    const existing = read(namespace)
    if (existing.some((sample) => sample.id === input.id)) return
    const samples = bounded([parsed.data, ...existing], Date.now())
    let serialized = JSON.stringify({ version: 1, samples })
    while (serialized.length > MAX_BYTES && samples.length) {
      samples.pop()
      serialized = JSON.stringify({ version: 1, samples })
    }
    localStorage.setItem(storageKey, serialized)
  } catch {
    /* Storage denial or quota does not affect generation. */
  }
}

/** Discards background/suspended observations instead of treating them as model latency. */
export function startGenerationTiming(): {
  finish: () => number | undefined
  dispose: () => void
} {
  if (typeof document === 'undefined' || typeof performance === 'undefined')
    return { finish: () => undefined, dispose: () => {} }
  const started = performance.now()
  let last = started
  let lastWall = Date.now()
  let valid = document.visibilityState === 'visible'
  let disposed = false
  function check() {
    const now = performance.now()
    const wall = Date.now()
    if (
      document.visibilityState !== 'visible' ||
      now - last > MAX_GAP ||
      wall - lastWall > MAX_GAP ||
      now < last ||
      wall < lastWall
    )
      valid = false
    last = now
    lastWall = wall
  }
  const timer = setInterval(check, 1000)
  document.addEventListener('visibilitychange', check)
  function dispose() {
    if (disposed) return
    disposed = true
    clearInterval(timer)
    document.removeEventListener('visibilitychange', check)
  }
  return {
    finish() {
      if (disposed) return
      check()
      const elapsed = performance.now() - started
      dispose()
      return valid && elapsed > 0 && elapsed <= MAX_ELAPSED
        ? elapsed
        : undefined
    },
    dispose
  }
}
