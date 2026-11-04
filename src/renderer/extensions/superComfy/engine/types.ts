import type {
  AppContract,
  EdgeId,
  ExecutableNode,
  GenerateContract,
  MediaItem,
  NodeId,
  PortRef,
  RunFailureCode,
  RunKey,
  RunRecord,
  SessionId,
  SettingValue,
  SuperGraphDocument,
  SuperNode
} from './documentSchema'

export type Block =
  | { reason: 'missingInputs'; ports: string[] }
  | { reason: 'tooManyRuns'; runs: number; limit: number }
  | { reason: 'tooManyItems'; port: string; count: number; max: number }
  | { reason: 'noContract' }
  | { reason: 'upstreamFailed'; nodeIds: NodeId[] }

export interface RunSlot {
  key: RunKey
  index: number
  state: 'cached' | 'queued' | 'running' | 'done' | 'failed'
  message?: string
  code?: RunFailureCode
  queuePosition?: number
  fraction?: number
}

export type NodeActivity =
  | { phase: 'idle' }
  | { phase: 'waiting'; sessionId: SessionId }
  | { phase: 'running'; sessionId: SessionId; slots: RunSlot[] }
  | { phase: 'upToDate'; sessionId: SessionId }
  | { phase: 'blocked'; sessionId: SessionId | null; block: Block }

export interface RunSession {
  id: SessionId
  scope: 'graph' | 'node'
  nodeIds: NodeId[]
  startedAt: number
}

export interface RuntimeState {
  sessions: Record<SessionId, RunSession>
  activity: Record<NodeId, NodeActivity>
}

export interface SuperComfyState {
  doc: SuperGraphDocument
  runtime: RuntimeState
}

export type EditEvent =
  | { type: 'documentLoaded'; doc: SuperGraphDocument }
  | { type: 'nodeAdded'; node: SuperNode }
  | { type: 'nodesRemoved'; nodeIds: NodeId[] }
  | { type: 'nodesMoved'; moves: { id: NodeId; x: number; y: number }[] }
  | { type: 'edgeConnected'; id: EdgeId; from: PortRef; to: PortRef }
  | { type: 'edgesRemoved'; edgeIds: EdgeId[] }
  | {
      type: 'itemsAdded'
      nodeId: NodeId
      items: MediaItem[]
      mode: 'append' | 'replace'
    }
  | { type: 'itemRemoved'; nodeId: NodeId; index: number }
  | { type: 'textItemChanged'; nodeId: NodeId; index: number; text: string }
  | {
      type: 'valueChanged'
      nodeId: NodeId
      name: string
      value: SettingValue | null
    }
  | { type: 'inlineChanged'; nodeId: NodeId; port: string; text: string }
  | { type: 'runCountChanged'; nodeId: NodeId; runCount: number }
  | { type: 'settingsToggled'; nodeId: NodeId }
  | { type: 'modelPicked'; nodeId: NodeId; modelId: string }
  | {
      type: 'modelContractResolved'
      nodeId: NodeId
      modelId: string
      modelLabel: string
      contract: GenerateContract
    }
  | {
      type: 'appContractResolved'
      nodeId: NodeId
      workflowPath: string
      title: string
      contract: AppContract
    }
  | { type: 'viewportChanged'; viewport: SuperGraphDocument['viewport'] }

export type RunEvent =
  | { type: 'sessionStarted'; session: RunSession }
  | { type: 'nodeBlocked'; sessionId: SessionId; nodeId: NodeId; block: Block }
  | { type: 'nodeUpToDate'; sessionId: SessionId; nodeId: NodeId }
  | {
      type: 'nodeStarted'
      sessionId: SessionId
      nodeId: NodeId
      planKeys: RunKey[]
      cachedIndices: number[]
    }
  | { type: 'runStarted'; sessionId: SessionId; nodeId: NodeId; index: number }
  | {
      type: 'runProgressed'
      sessionId: SessionId
      nodeId: NodeId
      index: number
      queuePosition?: number
      fraction?: number
    }
  | {
      type: 'runSucceeded'
      sessionId: SessionId
      nodeId: NodeId
      record: RunRecord
    }
  | {
      type: 'runFailed'
      sessionId: SessionId
      nodeId: NodeId
      index: number
      key: RunKey
      message?: string
      code?: RunFailureCode
    }
  | { type: 'nodeCommitted'; sessionId: SessionId; nodeId: NodeId; at: number }
  | { type: 'ioCollected'; sessionId: SessionId; nodeId: NodeId }
  | { type: 'sessionStopped'; sessionId: SessionId }
  | { type: 'sessionEnded'; sessionId: SessionId }
  | { type: 'runRefused'; nodeId: NodeId; block: Block }

export type SuperComfyEvent = EditEvent | RunEvent

export interface PlanOptions {
  runLimit: number
  exclude?: ReadonlySet<NodeId>
}

export interface PlannedRun {
  index: number
  repeat: number
  key: RunKey
  inputs: Record<string, MediaItem[]>
}

export type RunPlan =
  | { ok: true; runs: PlannedRun[] }
  | { ok: false; block: Block }

export type ConnectOutcome =
  | { ok: true; replaces?: EdgeId }
  | {
      ok: false
      reason:
        | 'self'
        | 'direction'
        | 'modality'
        | 'cycle'
        | 'full'
        | 'duplicate'
        | 'unknownPort'
    }

export interface RunRequest {
  node: ExecutableNode
  run: PlannedRun
  signal: AbortSignal
  onProgress: (p: { queuePosition?: number; fraction?: number }) => void
}

export type RunOutcome =
  | {
      ok: true
      outputs: Record<string, MediaItem[]>
      creditsUsed?: number
      notice?: string
    }
  | { ok: false; message: string }

export interface NodeExecution {
  run(request: RunRequest): Promise<RunOutcome>
  dispose(): Promise<void>
}

export interface Executor {
  readonly concurrency: number
  begin(node: ExecutableNode, signal: AbortSignal): NodeExecution
}

export interface Executors {
  generate: Executor
  app: Executor
}

export interface EngineHost {
  getState(): SuperComfyState
  dispatch(event: RunEvent): void
  executors: Executors
  newSessionId(): SessionId
  now(): number
  limits: { runsPerNode: number; nodesInParallel: number }
}

export type NodeOutcome =
  | 'complete'
  | 'partial'
  | 'failed'
  | 'upToDate'
  | 'blocked'
  | 'collected'
  | 'source'
  | 'stopped'

export type RunSummary =
  | { ok: true; sessionId: SessionId; outcomes: Record<NodeId, NodeOutcome> }
  | { ok: false; reason: 'busy' | 'alreadyRunning' | 'cycle' | 'blocked' }

export interface Engine {
  runGraph(): Promise<RunSummary>
  runNode(nodeId: NodeId): Promise<RunSummary>
  stop(sessionId?: SessionId): void
  isBusy(): boolean
}
