export type CustomNodeOutcome =
  | 'NOT_INSTALLED'
  | 'IMPORT_ERROR'
  | 'MISSING_NODE'
  | 'VALIDATION_FAIL'
  | 'EXECUTION_ERROR'
  | 'PARTIAL'
  | 'TIMEOUT'
  | 'PASS'

export interface ExecutionError {
  exceptionType?: string
  nodeId?: string
  nodeType?: string
  traceback?: string[]
}

export type PromptEvent =
  | { type: 'execution_start' }
  | { type: 'executing'; node: string | null }
  | { type: 'execution_success' }
  | { type: 'execution_error'; error: ExecutionError }
  | { type: 'execution_interrupted'; error?: ExecutionError }

export interface RunResult {
  outcome: CustomNodeOutcome
  executedNodes: string[]
  error?: ExecutionError
}

// `executing` with a non-null node is the only cache-safe "this node actually ran"
// signal: ComfyUI emits it solely for non-cached nodes (execution.py:493), while the
// `executed` message and /history outputs are replayed for cached nodes too.
function executedNodesFrom(events: PromptEvent[]): string[] {
  const executed = new Set<string>()
  for (const event of events) {
    if (event.type === 'executing' && event.node !== null)
      executed.add(event.node)
  }
  return [...executed]
}

export function classifyRun(input: {
  events: PromptEvent[]
  expectedNodeIds: string[]
  timedOut?: boolean
}): RunResult {
  const { events, expectedNodeIds, timedOut = false } = input
  const executedNodes = executedNodesFrom(events)

  if (timedOut) return { outcome: 'TIMEOUT', executedNodes }

  const failure = events.find(
    (
      event
    ): event is Extract<
      PromptEvent,
      { type: 'execution_error' | 'execution_interrupted' }
    > =>
      event.type === 'execution_error' || event.type === 'execution_interrupted'
  )
  if (failure)
    return { outcome: 'EXECUTION_ERROR', executedNodes, error: failure.error }

  if (!events.some((event) => event.type === 'execution_success'))
    return { outcome: 'TIMEOUT', executedNodes }

  const ranEveryExpected = expectedNodeIds.every((node) =>
    executedNodes.includes(node)
  )
  return { outcome: ranEveryExpected ? 'PASS' : 'PARTIAL', executedNodes }
}
