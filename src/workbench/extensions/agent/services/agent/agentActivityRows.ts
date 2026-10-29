import type { ActivityPart, PartState, ToolPart } from './agentMessageParts'

interface ToolRow {
  kind: 'tool'
  name: string
  skill?: string
  state: PartState
  ok?: boolean
  count: number
  canvasConfirmed?: boolean
}

interface ThinkingRow {
  kind: 'thinking'
  text: string
  state: PartState
}

export type ActivityRow = ToolRow | ThinkingRow

function matchingToolStep(
  previous: ActivityRow | undefined,
  part: ToolPart
): ToolRow | undefined {
  if (
    previous?.kind !== 'tool' ||
    previous.name !== part.name ||
    (part.name === 'load_skill' && previous.skill !== part.skill)
  )
    return undefined
  return previous
}

function foldCanvasConfirmed(
  previous: boolean | undefined,
  next: boolean | undefined
): boolean | undefined {
  if (previous === false || next === false) return false
  return previous ?? next
}

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
    const previous = matchingToolStep(rows.at(-1), part)
    if (previous) {
      previous.count += 1
      if (part.state === 'streaming') previous.state = 'streaming'
      if (part.ok !== undefined) previous.ok = part.ok
      previous.canvasConfirmed = foldCanvasConfirmed(
        previous.canvasConfirmed,
        part.canvasConfirmed
      )
    } else {
      rows.push({
        kind: 'tool',
        name: part.name,
        skill: part.skill,
        state: part.state,
        ok: part.ok,
        canvasConfirmed: part.canvasConfirmed,
        count: 1
      })
    }
  }
  return rows
}
