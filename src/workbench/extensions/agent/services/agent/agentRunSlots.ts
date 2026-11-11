import { sum } from 'es-toolkit'

import type { MessagePart, ToolPart } from './agentMessageParts'

type ToolPhase = 'absent' | 'running' | 'ok' | 'error'

export interface RunSlot {
  callId: string
  run: Exclude<ToolPhase, 'absent'>
  wait: ToolPhase
  output: ToolPhase
  toolDurationMs?: number
  awaitingApproval: boolean
  turnLive: boolean
}

export type RunCardView =
  | 'hidden'
  | 'starting'
  | 'running'
  | 'notStarted'
  | 'ran'
  | 'requested'

interface RunTurn {
  parts: readonly MessagePart[]
  streaming: boolean
}

interface RunToolParts {
  run: ToolPart
  wait: ToolPart[]
  output: ToolPart[]
}

const RUN_TOOL = 'run'
const WAIT_TOOL = 'wait_for_job'
const OUTPUT_TOOL = 'get_output'

function collectRuns(parts: readonly MessagePart[]): RunToolParts[] {
  const runs: RunToolParts[] = []
  for (const part of parts) {
    if (part.type !== 'tool') continue
    if (part.name === RUN_TOOL) {
      runs.push({ run: part, wait: [], output: [] })
      continue
    }
    const current = runs.at(-1)
    if (!current) continue
    if (part.name === WAIT_TOOL) current.wait.push(part)
    else if (part.name === OUTPUT_TOOL) current.output.push(part)
  }
  return runs
}

function phaseOf(part: ToolPart): Exclude<ToolPhase, 'absent'> {
  if (part.state === 'streaming') return 'running'
  return part.ok === false ? 'error' : 'ok'
}

function foldPhases(parts: readonly ToolPart[]): ToolPhase {
  if (parts.length === 0) return 'absent'
  const phases = parts.map(phaseOf)
  if (phases.includes('running')) return 'running'
  return phases.includes('error') ? 'error' : 'ok'
}

function knownDurationMs(parts: readonly ToolPart[]): number | undefined {
  const known = parts.flatMap((part) =>
    part.durationMs === undefined ? [] : [part.durationMs]
  )
  return known.length > 0 ? sum(known) : undefined
}

function isTerminal(phase: ToolPhase): boolean {
  return phase === 'ok' || phase === 'error'
}

export function runSlotsOf(message: RunTurn): RunSlot[] {
  const approvalPending = message.parts.some(
    (part) => part.type === 'runApproval'
  )
  return collectRuns(message.parts).map(({ run, wait, output }) => {
    const runPhase = phaseOf(run)
    const toolDurationMs = knownDurationMs([run, ...wait, ...output])
    return {
      callId: run.callId,
      run: runPhase,
      wait: foldPhases(wait),
      output: foldPhases(output),
      ...(toolDurationMs !== undefined ? { toolDurationMs } : {}),
      awaitingApproval: approvalPending && runPhase === 'running',
      turnLive: message.streaming
    }
  })
}

export function runOwnedCallIds(parts: readonly MessagePart[]): Set<string> {
  return new Set(
    collectRuns(parts).flatMap(({ run, wait, output }) =>
      [run, ...wait, ...output].map((part) => part.callId)
    )
  )
}

export function runCardView(slot: RunSlot): RunCardView {
  if (slot.awaitingApproval) return 'hidden'
  if (slot.run === 'error') return 'notStarted'
  if (slot.run === 'running') return slot.turnLive ? 'starting' : 'requested'
  if (isTerminal(slot.wait) || isTerminal(slot.output)) return 'ran'
  if (slot.turnLive) return 'running'
  return slot.wait === 'absent' ? 'requested' : 'ran'
}

export function isRunInFlight(slot: RunSlot): boolean {
  const view = runCardView(slot)
  return view === 'starting' || view === 'running'
}
