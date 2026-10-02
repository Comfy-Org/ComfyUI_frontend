import type { ActivityPart, PartState, ToolPart } from './agentMessageParts'

interface ToolRow {
  kind: 'tool'
  name: string
  skill?: string
  state: PartState
  ok?: boolean
  count: number
}

interface ThinkingRow {
  kind: 'thinking'
  text: string
  state: PartState
}

export type ActivityRow = ToolRow | ThinkingRow

function isSameToolStep(
  previous: ActivityRow | undefined,
  part: ToolPart
): boolean {
  return (
    previous?.kind === 'tool' &&
    previous.name === part.name &&
    (part.name !== 'load_skill' || previous.skill === part.skill)
  )
}

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
        state: part.state
      })
      continue
    }
    const previous = rows.at(-1)
    if (isSameToolStep(previous, part) && previous?.kind === 'tool') {
      previous.count += 1
      if (part.state === 'streaming') previous.state = 'streaming'
      if (part.ok !== undefined) previous.ok = part.ok
    } else {
      rows.push({
        kind: 'tool',
        name: part.name,
        skill: part.skill,
        state: part.state,
        ok: part.ok,
        count: 1
      })
    }
  }
  return rows
}
