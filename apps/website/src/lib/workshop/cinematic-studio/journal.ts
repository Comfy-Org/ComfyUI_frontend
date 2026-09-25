import { z } from 'zod'
import { creationSettingsSchema } from './creations'

const entrySchema = z.object({
  id: z.string().uuid(),
  modelSlug: z
    .string()
    .min(1)
    .max(200)
    .regex(/^[a-zA-Z0-9._-]+$/),
  contractId: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  prompt: z.string().max(50000),
  aspect: z.enum(['21:9', '16:9', '4:3', '3:2', '2:3', '1:1', '9:16']),
  startedAt: z.number().finite().nonnegative(),
  requestId: z.string().uuid().optional(),
  status: z.enum([
    'unknown',
    'pending',
    'cancelRequested',
    'complete',
    'terminal'
  ]),
  settings: creationSettingsSchema.optional()
})
export type CinematicJournalEntry = z.infer<typeof entrySchema>
const key = (namespace: string) =>
  `cinematic-requests-v1:${encodeURIComponent(namespace)}`
const listeners = new Set<(namespace: string) => void>()

export function subscribeCinematicJournal(
  listener: (namespace: string) => void
): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function readCinematicJournal(
  namespace: string
): CinematicJournalEntry[] {
  if (!namespace) throw new Error('Missing workspace')
  const data = localStorage.getItem(key(namespace))
  return data ? z.array(entrySchema).max(100).parse(JSON.parse(data)) : []
}

export function writeCinematicJournal(
  namespace: string,
  entry: CinematicJournalEntry
): void {
  const parsed = entrySchema.parse(entry)
  const entries = readCinematicJournal(namespace)
  const next = [...entries.filter((item) => item.id !== entry.id), parsed]
  if (next.length > 100)
    throw new Error('Resolve old requests before starting another')
  localStorage.setItem(key(namespace), JSON.stringify(next))
  listeners.forEach((listener) => listener(namespace))
}

export function removeCinematicJournal(namespace: string, id: string): void {
  const entries = readCinematicJournal(namespace)
  if (!entries.some((entry) => entry.id === id)) return
  localStorage.setItem(
    key(namespace),
    JSON.stringify(entries.filter((item) => item.id !== id))
  )
  listeners.forEach((listener) => listener(namespace))
}
