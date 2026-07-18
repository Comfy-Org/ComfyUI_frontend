type CustomNodeOutcome =
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
  | { type: 'executed'; node: string | null; output?: unknown }
  | { type: 'execution_success' }
  | { type: 'execution_error'; error: ExecutionError }
  | { type: 'execution_interrupted'; error?: ExecutionError }

export interface RunResult {
  outcome: CustomNodeOutcome
  executedNodes: string[]
  // ui payloads from `executed` events, keyed by node id - proof that data
  // reached each output node, not just that execution finished.
  outputsByNode: Record<string, unknown>
  error?: ExecutionError
  // Set when queuePrompt THREW client-side (pack JS hooking the queue can
  // crash on a graph shape it does not expect); carries the exception text
  // so the failing node self-identifies in the report.
  clientError?: string
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

function outputsFrom(events: PromptEvent[]): Record<string, unknown> {
  const outputs: Record<string, unknown> = {}
  for (const event of events) {
    if (event.type === 'executed' && event.node !== null)
      outputs[event.node] = event.output
  }
  return outputs
}

export function classifyRun(input: {
  events: PromptEvent[]
  expectedNodeIds: string[]
  // All node ids in the queued graph. An error naming a node outside it is a
  // stray from another prompt (late websocket delivery, or a duplicate queue
  // from the client-flap retry) and must not be pinned on this run.
  graphNodeIds?: string[]
  timedOut?: boolean
}): RunResult {
  const { events, expectedNodeIds, graphNodeIds, timedOut = false } = input
  const executedNodes = executedNodesFrom(events)
  const outputsByNode = outputsFrom(events)

  if (timedOut) return { outcome: 'TIMEOUT', executedNodes, outputsByNode }

  const failure = events.find(
    (
      event
    ): event is Extract<
      PromptEvent,
      { type: 'execution_error' | 'execution_interrupted' }
    > =>
      (event.type === 'execution_error' ||
        event.type === 'execution_interrupted') &&
      (graphNodeIds === undefined ||
        event.error?.nodeId === undefined ||
        graphNodeIds.includes(event.error.nodeId))
  )
  if (failure)
    return {
      outcome: 'EXECUTION_ERROR',
      executedNodes,
      outputsByNode,
      error: failure.error
    }

  if (!events.some((event) => event.type === 'execution_success'))
    return { outcome: 'TIMEOUT', executedNodes, outputsByNode }

  const ranEveryExpected = expectedNodeIds.every((node) =>
    executedNodes.includes(node)
  )
  return {
    outcome: ranEveryExpected ? 'PASS' : 'PARTIAL',
    executedNodes,
    outputsByNode
  }
}
