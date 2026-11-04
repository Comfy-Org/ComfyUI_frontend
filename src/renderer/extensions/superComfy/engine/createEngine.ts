import type {
  ExecutableNode,
  MediaItem,
  NodeId,
  RunFailureCode,
  SessionId,
  SuperGraphDocument
} from './documentSchema'
import {
  executionOrder,
  findNode,
  ioChainDownstream,
  upstreamIds
} from './graphTopology'
import { planRuns, samePlanKeys } from './planRuns'
import { mapWithConcurrency, scheduleByReadiness } from './scheduler'
import { activityOf } from './selectors'
import type {
  Engine,
  EngineHost,
  NodeExecution,
  NodeOutcome,
  PlannedRun,
  RunPlan,
  RunRequest,
  RunSession,
  RunSummary
} from './types'

type SettledRun =
  | {
      ok: true
      outputs: Record<string, MediaItem[]>
      creditsUsed?: number
      notice?: string
    }
  | { ok: false; message?: string; code?: RunFailureCode }

const EXCLUDING_OUTCOMES: ReadonlySet<NodeOutcome> = new Set<NodeOutcome>([
  'blocked',
  'failed',
  'stopped'
])

function hasOutput(outputs: Record<string, MediaItem[]>): boolean {
  return Object.values(outputs).some((items) => items.length > 0)
}

async function attemptRun(
  execution: NodeExecution,
  request: RunRequest
): Promise<SettledRun> {
  try {
    const outcome = await execution.run(request)
    if (!outcome.ok) return { ok: false, message: outcome.message }
    if (!hasOutput(outcome.outputs)) return { ok: false, code: 'noOutput' }
    return outcome
  } catch (error) {
    return {
      ok: false,
      code: 'threw',
      message: error instanceof Error ? error.message : String(error)
    }
  }
}

function isUpToDate(node: ExecutableNode, runs: PlannedRun[]): boolean {
  return (
    node.result?.status === 'complete' &&
    samePlanKeys(
      node.result.planKeys,
      runs.map(({ key }) => key)
    )
  )
}

function findExecutable(
  doc: SuperGraphDocument,
  nodeId: NodeId
): ExecutableNode | undefined {
  const node = findNode(doc, nodeId)
  return node?.kind === 'io' ? undefined : node
}

export function createEngine(host: EngineHost): Engine {
  const controllers = new Map<SessionId, AbortController>()

  const isBusy = () => Object.keys(host.getState().runtime.sessions).length > 0

  function openSession(scope: RunSession['scope'], nodeIds: NodeId[]) {
    const session: RunSession = {
      id: host.newSessionId(),
      scope,
      nodeIds,
      startedAt: host.now()
    }
    const controller = new AbortController()
    controllers.set(session.id, controller)
    host.dispatch({ type: 'sessionStarted', session })
    return { sessionId: session.id, signal: controller.signal }
  }

  function closeSession(sessionId: SessionId) {
    controllers.delete(sessionId)
    host.dispatch({ type: 'sessionEnded', sessionId })
  }

  async function runOne(
    sessionId: SessionId,
    node: ExecutableNode,
    execution: NodeExecution,
    run: PlannedRun,
    signal: AbortSignal
  ) {
    const nodeId = node.id
    const { index, key } = run
    host.dispatch({ type: 'runStarted', sessionId, nodeId, index })
    const settled = await attemptRun(execution, {
      node,
      run,
      signal,
      onProgress: (progress) => {
        if (signal.aborted) return
        host.dispatch({
          type: 'runProgressed',
          sessionId,
          nodeId,
          index,
          ...progress
        })
      }
    })
    if (settled.ok) {
      host.dispatch({
        type: 'runSucceeded',
        sessionId,
        nodeId,
        record: {
          key,
          index,
          outputs: settled.outputs,
          finishedAt: host.now(),
          creditsUsed: settled.creditsUsed,
          notice: settled.notice
        }
      })
      return
    }
    if (signal.aborted) return
    host.dispatch({
      type: 'runFailed',
      sessionId,
      nodeId,
      index,
      key,
      message: settled.message,
      code: settled.code
    })
  }

  async function runPending(
    sessionId: SessionId,
    node: ExecutableNode,
    pending: PlannedRun[],
    signal: AbortSignal
  ) {
    if (pending.length === 0) return
    const executor = host.executors[node.kind]
    const execution = executor.begin(node, signal)
    try {
      await mapWithConcurrency(
        pending,
        executor.concurrency,
        (run) => runOne(sessionId, node, execution, run, signal),
        signal
      )
    } finally {
      await execution.dispose()
    }
  }

  function committedStatus(nodeId: NodeId): NodeOutcome {
    const node = findExecutable(host.getState().doc, nodeId)
    return node?.result?.status ?? 'failed'
  }

  async function executeRuns(
    sessionId: SessionId,
    node: ExecutableNode,
    runs: PlannedRun[],
    cachedIndices: number[],
    signal: AbortSignal
  ): Promise<NodeOutcome> {
    host.dispatch({
      type: 'nodeStarted',
      sessionId,
      nodeId: node.id,
      planKeys: runs.map(({ key }) => key),
      cachedIndices
    })
    const cached = new Set(cachedIndices)
    const pending = runs.filter(({ index }) => !cached.has(index))
    await runPending(sessionId, node, pending, signal)
    if (signal.aborted) return 'stopped'
    host.dispatch({
      type: 'nodeCommitted',
      sessionId,
      nodeId: node.id,
      at: host.now()
    })
    return committedStatus(node.id)
  }

  function blockOnUpstream(
    sessionId: SessionId,
    nodeId: NodeId,
    failedUpstream: NodeId[]
  ): NodeOutcome {
    host.dispatch({
      type: 'nodeBlocked',
      sessionId,
      nodeId,
      block: { reason: 'upstreamFailed', nodeIds: failedUpstream }
    })
    return 'blocked'
  }

  function settleExecutable(
    sessionId: SessionId,
    node: ExecutableNode,
    plan: RunPlan,
    signal: AbortSignal
  ): NodeOutcome | Promise<NodeOutcome> {
    const nodeId = node.id
    if (!plan.ok) {
      host.dispatch({
        type: 'nodeBlocked',
        sessionId,
        nodeId,
        block: plan.block
      })
      return 'blocked'
    }
    if (isUpToDate(node, plan.runs)) {
      host.dispatch({ type: 'nodeUpToDate', sessionId, nodeId })
      return 'upToDate'
    }
    const cachedIndices = plan.runs
      .filter(({ key }) => Object.hasOwn(node.runs, key))
      .map(({ index }) => index)
    return executeRuns(sessionId, node, plan.runs, cachedIndices, signal)
  }

  async function settleNode(
    sessionId: SessionId,
    nodeId: NodeId,
    exclude: ReadonlySet<NodeId>,
    signal: AbortSignal
  ): Promise<NodeOutcome> {
    if (signal.aborted) return 'stopped'
    const { doc } = host.getState()
    const node = findNode(doc, nodeId)
    if (!node) return 'blocked'
    const upstream = upstreamIds(doc, nodeId)
    if (node.kind === 'io' && upstream.length === 0) return 'source'
    const failedUpstream = upstream.filter((id) => exclude.has(id))
    if (failedUpstream.length > 0) {
      return blockOnUpstream(sessionId, nodeId, failedUpstream)
    }
    if (node.kind === 'io') {
      host.dispatch({ type: 'ioCollected', sessionId, nodeId })
      return 'collected'
    }
    const plan = planRuns(doc, nodeId, {
      runLimit: host.limits.runsPerNode,
      exclude
    })
    return settleExecutable(sessionId, node, plan, signal)
  }

  async function runGraph(): Promise<RunSummary> {
    if (isBusy()) return { ok: false, reason: 'busy' }
    const { order, cyclic } = executionOrder(host.getState().doc)
    if (cyclic.length > 0) return { ok: false, reason: 'cycle' }
    const { sessionId, signal } = openSession('graph', order)
    const outcomes = new Map<NodeId, NodeOutcome>()
    const exclude = new Set<NodeId>()
    try {
      await scheduleByReadiness({
        order,
        upstreamOf: (id) => upstreamIds(host.getState().doc, id),
        start: async (id) => {
          const outcome = await settleNode(sessionId, id, exclude, signal)
          outcomes.set(id, outcome)
          if (EXCLUDING_OUTCOMES.has(outcome)) exclude.add(id)
        },
        maxParallel: host.limits.nodesInParallel,
        signal
      })
    } finally {
      closeSession(sessionId)
    }
    return {
      ok: true,
      sessionId,
      outcomes: Object.fromEntries(
        order.map((id) => [id, outcomes.get(id) ?? 'stopped'])
      )
    }
  }

  function collectAfterNodeRun(
    sessionId: SessionId,
    ioId: NodeId,
    outcome: NodeOutcome
  ): NodeOutcome {
    if (outcome !== 'complete' && outcome !== 'partial') {
      return outcome === 'stopped' ? 'stopped' : 'blocked'
    }
    host.dispatch({ type: 'ioCollected', sessionId, nodeId: ioId })
    return 'collected'
  }

  async function runNode(nodeId: NodeId): Promise<RunSummary> {
    const state = host.getState()
    const sessions = Object.values(state.runtime.sessions)
    if (sessions.some(({ scope }) => scope === 'graph')) {
      return { ok: false, reason: 'busy' }
    }
    const { phase } = activityOf(state, nodeId)
    if (phase === 'waiting' || phase === 'running') {
      return { ok: false, reason: 'alreadyRunning' }
    }
    const plan = planRuns(state.doc, nodeId, {
      runLimit: host.limits.runsPerNode
    })
    if (!plan.ok) {
      host.dispatch({ type: 'runRefused', nodeId, block: plan.block })
      return { ok: false, reason: 'blocked' }
    }
    const node = findExecutable(state.doc, nodeId)
    if (!node) return { ok: false, reason: 'blocked' }
    const chain = ioChainDownstream(state.doc, nodeId)
    const { sessionId, signal } = openSession('node', [nodeId, ...chain])
    const outcomes = new Map<NodeId, NodeOutcome>()
    try {
      const outcome = await executeRuns(sessionId, node, plan.runs, [], signal)
      outcomes.set(nodeId, outcome)
      for (const ioId of chain) {
        outcomes.set(ioId, collectAfterNodeRun(sessionId, ioId, outcome))
      }
    } finally {
      closeSession(sessionId)
    }
    return { ok: true, sessionId, outcomes: Object.fromEntries(outcomes) }
  }

  function stop(sessionId?: SessionId) {
    const ids =
      sessionId === undefined
        ? Object.keys(host.getState().runtime.sessions)
        : [sessionId]
    for (const id of ids) {
      controllers.get(id)?.abort()
      host.dispatch({ type: 'sessionStopped', sessionId: id })
    }
  }

  return { runGraph, runNode, stop, isBusy }
}
