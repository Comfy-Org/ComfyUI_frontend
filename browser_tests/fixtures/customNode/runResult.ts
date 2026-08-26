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
  exceptionMessage?: string
  exceptionType?: string
  nodeId?: string
  nodeType?: string
  traceback?: string[]
}

export type PromptEvent =
  | { type: 'execution_start' }
  | { type: 'executing'; node: string | null }
  | { type: 'execution_cached'; nodes: string[] }
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

export function describeRunOutcome(result: RunResult): string {
  if (!result.error) return result.outcome
  const identity = [result.error.nodeType, result.error.exceptionType]
    .filter(Boolean)
    .join(': ')
  const detail = [identity, result.error.exceptionMessage]
    .filter(Boolean)
    .join(' - ')
  return `${result.outcome} (${detail || 'error event carried no details'})`
}

// A node's output is present for this prompt via one of two disjoint signals:
// `executing` fires solely for nodes that actually ran (execution.py:493), and
// `execution_cached` names, once per prompt, every node the backend served from
// cache instead. Counting only the first makes a verdict track the backend's
// cache temperature - a node that PASSed on a cold cache reads PARTIAL on the
// next run. The `executed` message stays excluded: it replays for cached nodes
// without naming them, so it cannot distinguish the two.
function executedNodesFrom(
  events: PromptEvent[],
  graphNodeIds?: string[]
): string[] {
  const inGraph = (node: string) =>
    graphNodeIds === undefined || graphNodeIds.includes(node)
  const executed = new Set<string>()
  for (const event of events) {
    if (
      event.type === 'executing' &&
      event.node !== null &&
      inGraph(event.node)
    )
      executed.add(event.node)
    if (event.type === 'execution_cached')
      for (const node of event.nodes) if (inGraph(node)) executed.add(node)
  }
  return [...executed]
}

function outputsFrom(
  events: PromptEvent[],
  graphNodeIds?: string[]
): Record<string, unknown> {
  const outputs: Record<string, unknown> = {}
  for (const event of events) {
    if (
      event.type === 'executed' &&
      event.node !== null &&
      (graphNodeIds === undefined || graphNodeIds.includes(event.node))
    )
      outputs[event.node] = event.output
  }
  return outputs
}

export function classifyRun(input: {
  events: PromptEvent[]
  expectedNodeIds: string[]
  proofOutputNodeByExpectedNode?: Record<string, string>
  graphNodeIds?: string[]
  timedOut?: boolean
}): RunResult {
  const {
    events,
    expectedNodeIds,
    proofOutputNodeByExpectedNode = {},
    graphNodeIds,
    timedOut = false
  } = input
  const executedNodes = executedNodesFrom(events, graphNodeIds)
  const outputsByNode = outputsFrom(events, graphNodeIds)

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

  const ranEveryExpected = expectedNodeIds.every((node) => {
    if (executedNodes.includes(node)) return true
    const proofNode = proofOutputNodeByExpectedNode[node]
    return (
      proofNode !== undefined &&
      Object.hasOwn(outputsByNode, proofNode) &&
      outputsByNode[proofNode] != null
    )
  })
  return {
    outcome: ranEveryExpected ? 'PASS' : 'PARTIAL',
    executedNodes,
    outputsByNode
  }
}
