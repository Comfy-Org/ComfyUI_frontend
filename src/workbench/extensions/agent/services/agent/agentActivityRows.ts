import type { ActivityPart, PartState } from './agentMessageParts'

interface ToolRow {
  kind: 'tool'
  name: string
  state: PartState
  ok?: boolean
  count: number
  durationMs?: number
}

interface ThinkingRow {
  kind: 'thinking'
  text: string
  state: PartState
  durationMs?: number
}

export type ActivityRow = ToolRow | ThinkingRow

/**
 * Consecutive calls to the same tool read as one step carrying a count: the
 * transport keeps every call so a single one stays addressable, the trace only
 * needs the shape of the work.
 */
export function foldActivity(parts: readonly ActivityPart[]): ActivityRow[] {
  const rows: ActivityRow[] = []
  for (const part of parts) {
    if (part.type === 'thinking') {
      rows.push({
        kind: 'thinking',
        text: part.text,
        state: part.state,
        durationMs: part.durationMs
      })
      continue
    }
    const previous = rows.at(-1)
    if (previous?.kind === 'tool' && previous.name === part.name) {
      previous.count += 1
      if (part.state === 'streaming') previous.state = 'streaming'
      if (part.ok === false) previous.ok = false
      if (part.durationMs !== undefined)
        previous.durationMs = (previous.durationMs ?? 0) + part.durationMs
    } else {
      rows.push({
        kind: 'tool',
        name: part.name,
        state: part.state,
        ok: part.ok,
        count: 1,
        durationMs: part.durationMs
      })
    }
  }
  return rows
}

export function totalDurationMs(parts: readonly ActivityPart[]): number {
  return parts.reduce((total, part) => total + (part.durationMs ?? 0), 0)
}
