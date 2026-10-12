import { z } from 'astro/zod'

import { WorkshopRouterError } from './workshop-router-errors'

const turnsSchema = z
  .array(z.object({ text: z.string(), voice_id: z.string() }).strict())
  .min(1)

export function workshopDialogueTurns(value: unknown) {
  if (typeof value !== 'string') return undefined
  try {
    const parsed = turnsSchema.safeParse(JSON.parse(value))
    return parsed.success ? parsed.data : undefined
  } catch {
    return undefined
  }
}

export function prepareWorkshopDialogue(value: unknown) {
  const turns = workshopDialogueTurns(value)
  if (
    !turns ||
    turns.some((turn) => !turn.text.trim() || !turn.voice_id.trim())
  )
    throw new WorkshopRouterError('validation', null, { inputs: 'required' })
  if (new Set(turns.map((turn) => turn.voice_id)).size > 10)
    throw new WorkshopRouterError('validation', null, { inputs: 'rejected' })
  return turns
}
