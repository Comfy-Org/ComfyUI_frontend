import type {
  AppNode,
  FileModality,
  GenerateNode,
  IoNode,
  MediaItem,
  Modality,
  NodeId,
  PortSpec,
  SettingSpec,
  SettingValue,
  SuperEdge,
  SuperGraphDocument,
  SuperNode
} from './documentSchema'
import { emptyDocument } from './documentSchema'
import { initialRuntime, reduceSuperComfy } from './reduce'
import type {
  EngineHost,
  Executor,
  Executors,
  NodeExecution,
  RunEvent,
  RunOutcome,
  RunRequest,
  SuperComfyEvent,
  SuperComfyState
} from './types'

interface ExecutableOptions {
  inputs?: PortSpec[]
  outputModality?: Modality
  runCount?: number
  values?: Record<string, SettingValue>
  inline?: Record<string, string>
  settings?: SettingSpec[]
}

export function fileItem(
  filename: string,
  modality: FileModality = 'image'
): MediaItem {
  return {
    kind: 'file',
    modality,
    ref: { filename, subfolder: '', type: 'input' }
  }
}

export function port(
  name: string,
  modality: Modality,
  options: Partial<Omit<PortSpec, 'name' | 'modality'>> = {}
): PortSpec {
  return {
    name,
    label: name,
    modality,
    required: false,
    multi: false,
    ...options
  }
}

export function ioNode(
  id: NodeId,
  modality: Modality,
  items: MediaItem[] = []
): IoNode {
  return { id, kind: 'io', modality, items, x: 0, y: 0, width: 240 }
}

function executableBase(id: NodeId, options: ExecutableOptions) {
  return {
    id,
    x: 0,
    y: 0,
    width: 280,
    runCount: options.runCount ?? 1,
    settingsOpen: true,
    values: options.values ?? {},
    inline: options.inline ?? {},
    runs: {},
    result: null
  }
}

export function generateNode(
  id: NodeId,
  modality: Modality,
  options: ExecutableOptions = {}
): GenerateNode {
  return {
    ...executableBase(id, options),
    kind: 'generate',
    modality,
    modelId: 'fake/model',
    modelLabel: 'model',
    contract: {
      version: 'v1',
      inputs: options.inputs ?? [],
      outputs: [port('out', options.outputModality ?? modality)],
      settings: options.settings ?? []
    }
  }
}

export function appNode(id: NodeId, options: ExecutableOptions = {}): AppNode {
  return {
    ...executableBase(id, options),
    kind: 'app',
    workflowPath: `${id}.app.json`,
    title: id,
    contract: {
      version: 1,
      inputs: (options.inputs ?? []).map((input) => ({
        ...input,
        target: { nodeId: '1', widgetName: input.name }
      })),
      outputs: [
        {
          ...port('out', options.outputModality ?? 'image'),
          outputNodeId: '9'
        }
      ],
      settings: [],
      dropped: 0
    }
  }
}

export function withLastResult<T extends GenerateNode | AppNode>(
  node: T,
  items: MediaItem[]
): T {
  return {
    ...node,
    result: {
      planKeys: [],
      outputs: { out: items },
      failures: [],
      status: 'complete',
      finishedAt: 0
    }
  }
}

export function edge(
  fromNode: NodeId,
  fromPort: string,
  toNode: NodeId,
  toPort: string
): SuperEdge {
  return {
    id: `${fromNode}.${fromPort}>${toNode}.${toPort}`,
    seq: 0,
    from: { node: fromNode, port: fromPort },
    to: { node: toNode, port: toPort }
  }
}

export function docWith(
  nodes: SuperNode[],
  edges: SuperEdge[] = []
): SuperGraphDocument {
  return {
    ...emptyDocument(),
    nodes,
    edges: edges.map((wire, seq) => ({ ...wire, seq })),
    nextSeq: edges.length
  }
}

export function succeeded(...items: MediaItem[]): RunOutcome {
  return { ok: true, outputs: { out: items } }
}

type Answer = (request: RunRequest) => RunOutcome | Error

export function freshOutputs(): Answer {
  let produced = 0
  return (request) => {
    produced += 1
    return succeeded(
      fileItem(`${request.node.id}.${request.run.index}#${produced}`)
    )
  }
}

export interface FakeCall {
  readonly request: RunRequest
  resolve(outcome: RunOutcome): void
  reject(error: Error): void
  readonly settled: boolean
}

export interface FakeExecutor extends Executor {
  readonly calls: FakeCall[]
  maxInFlight(): number
  untilCalls(count: number): Promise<void>
  answerAll(answer: Answer): void
}

function answerCall(call: FakeCall, answer: Answer) {
  const outcome = answer(call.request)
  if (outcome instanceof Error) call.reject(outcome)
  else call.resolve(outcome)
}

export function deferredExecutor(
  options: { concurrency?: number; answer?: Answer } = {}
): FakeExecutor {
  const calls: FakeCall[] = []
  const waiters: { count: number; wake: () => void }[] = []
  let answer = options.answer
  let inFlight = 0
  let peak = 0

  const wakeWaiters = () => {
    for (const waiter of waiters.filter(({ count }) => calls.length >= count)) {
      waiters.splice(waiters.indexOf(waiter), 1)
      waiter.wake()
    }
  }

  const execution: NodeExecution = {
    run: (request) =>
      new Promise<RunOutcome>((resolve, reject) => {
        inFlight += 1
        peak = Math.max(peak, inFlight)
        let settled = false
        const finish = () => {
          if (settled) return false
          settled = true
          inFlight -= 1
          return true
        }
        const call: FakeCall = {
          request,
          resolve: (outcome) => {
            if (finish()) resolve(outcome)
          },
          reject: (error) => {
            if (finish()) reject(error)
          },
          get settled() {
            return settled
          }
        }
        calls.push(call)
        wakeWaiters()
        if (answer) answerCall(call, answer)
      }),
    dispose: () => Promise.resolve()
  }

  return {
    concurrency: options.concurrency ?? 4,
    begin: () => execution,
    calls,
    maxInFlight: () => peak,
    untilCalls: (count) =>
      new Promise<void>((wake) => {
        waiters.push({ count, wake })
        wakeWaiters()
      }),
    answerAll: (next) => {
      answer = next
      for (const call of calls.filter(({ settled }) => !settled)) {
        answerCall(call, next)
      }
    }
  }
}

export interface TestHost {
  host: EngineHost
  state(): SuperComfyState
  events: RunEvent[]
  edit(event: SuperComfyEvent): void
  until(
    predicate: (state: SuperComfyState, events: RunEvent[]) => boolean
  ): Promise<void>
}

export function testHost(
  doc: SuperGraphDocument,
  executors: Executors,
  limits = { runsPerNode: 50, nodesInParallel: 2 }
): TestHost {
  let state: SuperComfyState = { doc, runtime: initialRuntime() }
  const events: RunEvent[] = []
  const waiters: {
    predicate: (state: SuperComfyState, events: RunEvent[]) => boolean
    wake: () => void
  }[] = []
  let sessions = 0
  let clock = 0

  const wakeWaiters = () => {
    for (const waiter of waiters.filter(({ predicate }) =>
      predicate(state, events)
    )) {
      waiters.splice(waiters.indexOf(waiter), 1)
      waiter.wake()
    }
  }

  return {
    host: {
      getState: () => state,
      dispatch: (event) => {
        events.push(event)
        state = reduceSuperComfy(state, event)
        wakeWaiters()
      },
      executors,
      newSessionId: () => {
        sessions += 1
        return `session-${sessions}`
      },
      now: () => {
        clock += 1
        return clock
      },
      limits
    },
    state: () => state,
    events,
    edit: (event) => {
      state = reduceSuperComfy(state, event)
    },
    until: (predicate) =>
      new Promise<void>((wake) => {
        waiters.push({ predicate, wake })
        wakeWaiters()
      })
  }
}
