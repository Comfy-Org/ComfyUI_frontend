import type {
  ExecutionError,
  PromptEvent
} from '@e2e/fixtures/customNode/runResult'

export interface RawPromptEvent {
  type: string
  node?: string | null
  nodes?: (string | number)[]
  prompt_id?: string
  output?: unknown
  exception_message?: string
  exception_type?: string
  node_id?: string
  node_type?: string
  traceback?: string[]
}

const TERMINAL_EVENT_TYPES = new Set([
  'execution_success',
  'execution_error',
  'execution_interrupted'
])

export function eventsForPrompt(
  events: readonly RawPromptEvent[],
  promptId: string
): RawPromptEvent[] {
  const scoped: RawPromptEvent[] = []
  let active = false
  for (const event of events) {
    if (event.type === 'execution_start' && event.prompt_id !== undefined)
      active = event.prompt_id === promptId

    if (
      event.prompt_id === promptId ||
      (event.prompt_id === undefined && active)
    )
      scoped.push(event)

    if (TERMINAL_EVENT_TYPES.has(event.type) && event.prompt_id === promptId)
      active = false
  }
  return scoped
}

export function toPromptEvent(raw: RawPromptEvent): PromptEvent {
  if (raw.type === 'executing')
    return { type: 'executing', node: raw.node ?? null }
  if (raw.type === 'executed')
    return { type: 'executed', node: raw.node ?? null, output: raw.output }
  if (raw.type === 'execution_cached')
    return { type: 'execution_cached', nodes: (raw.nodes ?? []).map(String) }
  if (raw.type === 'execution_error' || raw.type === 'execution_interrupted') {
    const error: ExecutionError = {
      exceptionMessage: raw.exception_message?.trimEnd(),
      exceptionType: raw.exception_type,
      nodeId: raw.node_id,
      nodeType: raw.node_type,
      traceback: raw.traceback
    }
    return { type: raw.type, error }
  }
  return { type: raw.type as 'execution_start' | 'execution_success' }
}
