import type { ActivityPart, PartState, ToolPart } from './agentMessageParts'

interface ToolRow {
  kind: 'tool'
  name: string
  skill?: string
  state: PartState
  ok?: boolean
  count: number
  /**
   * PM-1343: see `ToolPart.canvasConfirmed`. Folded pessimistically below —
   * one unconfirmed call in a folded group makes the whole row unconfirmed,
   * because the row is the only thing the person sees and "two of three edits
   * reached your canvas" must not render as a settled success.
   */
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

/**
 * PM-1343: pessimistic fold. One unconfirmed call makes the whole folded row
 * unconfirmed and that verdict is not undone by a later confirmed sibling,
 * because the row is the only thing the person sees -- "two of three edits
 * reached your canvas" must not render as a settled success. `true` therefore
 * only ever fills an answer that is still absent.
 */
function foldCanvasConfirmed(previous: ToolRow, part: ToolPart): void {
  if (part.canvasConfirmed === false) previous.canvasConfirmed = false
  else if (
    part.canvasConfirmed === true &&
    previous.canvasConfirmed === undefined
  )
    previous.canvasConfirmed = true
}

/** Absorbs a repeat call into the step already standing for it. */
function mergeIntoStep(previous: ToolRow, part: ToolPart): void {
  previous.count += 1
  if (part.state === 'streaming') previous.state = 'streaming'
  if (part.ok !== undefined) previous.ok = part.ok
  foldCanvasConfirmed(previous, part)
}

function toRow(part: ActivityPart): ActivityRow {
  return part.type === 'thinking'
    ? { kind: 'thinking', text: part.text, state: part.state }
    : {
        kind: 'tool',
        name: part.name,
        skill: part.skill,
        state: part.state,
        ok: part.ok,
        canvasConfirmed: part.canvasConfirmed,
        count: 1
      }
}

/**
 * Consecutive calls to the same tool read as one step carrying a count: the
 * transport keeps every call so a single one stays addressable, the trace only
 * needs the shape of the work.
 */
export function foldActivity(parts: readonly ActivityPart[]): ActivityRow[] {
  const rows: ActivityRow[] = []
  for (const part of parts) {
    if (part.type !== 'thinking') {
      const previous = matchingToolStep(rows.at(-1), part)
      if (previous) {
        mergeIntoStep(previous, part)
        continue
      }
    }
    rows.push(toRow(part))
  }
  return rows
}
