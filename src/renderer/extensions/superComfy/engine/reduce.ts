import type {
  AppContract,
  AppNode,
  ExecutableNode,
  GenerateContract,
  GenerateNode,
  IoNode,
  MediaItem,
  NodeId,
  NodeResult,
  PortSpec,
  RunKey,
  RunRecord,
  SessionId,
  SettingSpec,
  SettingValue,
  SuperGraphDocument,
  SuperNode
} from './documentSchema'
import { canConnect, findNode, incomingEdges, portsOf } from './graphTopology'
import { textItem } from './items'
import { sourceItems } from './planRuns'
import { activityOf } from './selectors'
import type {
  EditEvent,
  NodeActivity,
  RunEvent,
  RunSession,
  RunSlot,
  RuntimeState,
  SuperComfyEvent,
  SuperComfyState
} from './types'

type NodeEdit = Extract<
  EditEvent,
  {
    type:
      | 'itemsAdded'
      | 'itemRemoved'
      | 'textItemChanged'
      | 'valueChanged'
      | 'inlineChanged'
      | 'runCountChanged'
      | 'settingsToggled'
      | 'modelPicked'
  }
>
type GraphEdit = Exclude<
  EditEvent,
  { type: 'documentLoaded' | 'nodesRemoved' | NodeEdit['type'] }
>
type SessionRunEvent = Exclude<
  RunEvent,
  {
    type: 'sessionStarted' | 'sessionStopped' | 'sessionEnded' | 'runRefused'
  }
>
type OwnedRunEvent = Exclude<SessionRunEvent, { type: 'runSucceeded' }>

const RUN_EVENT_TYPES: Record<RunEvent['type'], true> = {
  sessionStarted: true,
  nodeBlocked: true,
  nodeUpToDate: true,
  nodeStarted: true,
  runStarted: true,
  runProgressed: true,
  runSucceeded: true,
  runFailed: true,
  nodeCommitted: true,
  ioCollected: true,
  sessionStopped: true,
  sessionEnded: true,
  runRefused: true
}

const NODE_EDIT_TYPES: Record<NodeEdit['type'], true> = {
  itemsAdded: true,
  itemRemoved: true,
  textItemChanged: true,
  valueChanged: true,
  inlineChanged: true,
  runCountChanged: true,
  settingsToggled: true,
  modelPicked: true
}

function isRunEvent(event: SuperComfyEvent): event is RunEvent {
  return Object.hasOwn(RUN_EVENT_TYPES, event.type)
}

function isNodeEdit(event: SuperComfyEvent): event is NodeEdit {
  return Object.hasOwn(NODE_EDIT_TYPES, event.type)
}

export function initialRuntime(): RuntimeState {
  return { sessions: {}, activity: {} }
}

function withDoc(
  state: SuperComfyState,
  doc: SuperGraphDocument
): SuperComfyState {
  return doc === state.doc ? state : { ...state, doc }
}

function mapNode(
  doc: SuperGraphDocument,
  nodeId: NodeId,
  update: (node: SuperNode) => SuperNode
): SuperGraphDocument {
  return {
    ...doc,
    nodes: doc.nodes.map((node) => (node.id === nodeId ? update(node) : node))
  }
}

function onIo(update: (node: IoNode) => IoNode) {
  return (node: SuperNode): SuperNode =>
    node.kind === 'io' ? update(node) : node
}

function onExecutable(update: (node: ExecutableNode) => ExecutableNode) {
  return (node: SuperNode): SuperNode =>
    node.kind === 'io' ? node : update(node)
}

function withoutKey<T>(
  record: Record<string, T>,
  key: string
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).filter(([name]) => name !== key)
  )
}

function setActivity(
  state: SuperComfyState,
  nodeId: NodeId,
  activity: NodeActivity
): SuperComfyState {
  return {
    ...state,
    runtime: {
      ...state.runtime,
      activity: { ...state.runtime.activity, [nodeId]: activity }
    }
  }
}

function sessionOf(activity: NodeActivity): SessionId | null {
  return activity.phase === 'idle' ? null : activity.sessionId
}

function owns(
  state: SuperComfyState,
  nodeId: NodeId,
  sessionId: SessionId
): boolean {
  return (
    Object.hasOwn(state.runtime.sessions, sessionId) &&
    sessionOf(activityOf(state, nodeId)) === sessionId
  )
}

function inRange(value: number, min?: number, max?: number): boolean {
  return (
    (min === undefined || value >= min) && (max === undefined || value <= max)
  )
}

function isValidValue(spec: SettingSpec, value: SettingValue): boolean {
  switch (spec.control) {
    case 'select':
      return spec.options.some((option) => option === value)
    case 'number':
      return (
        typeof value === 'number' &&
        (!spec.integer || Number.isInteger(value)) &&
        inRange(value, spec.min, spec.max)
      )
    case 'toggle':
      return typeof value === 'boolean'
    case 'text':
      return typeof value === 'string'
  }
}

export function mergeContractValues(
  values: Record<string, SettingValue>,
  settings: SettingSpec[]
): Record<string, SettingValue> {
  return Object.fromEntries(
    Object.entries(values).filter(([name, value]) => {
      const spec = settings.find((setting) => setting.name === name)
      return spec !== undefined && isValidValue(spec, value)
    })
  )
}

function keepInline(
  inline: Record<string, string>,
  inputs: readonly PortSpec[]
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(inline).filter(([name]) =>
      inputs.some((port) => port.name === name && port.inline)
    )
  )
}

function seedAppInline(
  inline: Record<string, string>,
  previous: AppContract | null,
  next: AppContract
): Record<string, string> {
  const known = new Set(previous?.inputs.map(({ name }) => name) ?? [])
  const seeded = next.inputs
    .filter(
      (port) =>
        port.inline &&
        !known.has(port.name) &&
        !Object.hasOwn(inline, port.name) &&
        (port.default ?? '') !== ''
    )
    .map((port) => [port.name, port.default ?? ''])
  return { ...inline, ...Object.fromEntries(seeded) }
}

function pruneEdges(
  doc: SuperGraphDocument,
  nodeId: NodeId
): SuperGraphDocument {
  const node = findNode(doc, nodeId)
  if (!node) return doc
  const ports = portsOf(node)
  const inputs = new Set(ports.inputs.map(({ name }) => name))
  const outputs = new Set(ports.outputs.map(({ name }) => name))
  return {
    ...doc,
    edges: doc.edges.filter(
      (edge) =>
        (edge.to.node !== nodeId || inputs.has(edge.to.port)) &&
        (edge.from.node !== nodeId || outputs.has(edge.from.port))
    )
  }
}

function applyModelContract(
  doc: SuperGraphDocument,
  event: { nodeId: NodeId; modelId: string; modelLabel: string },
  contract: GenerateContract
): SuperGraphDocument {
  const node = findNode(doc, event.nodeId)
  if (node?.kind !== 'generate' || node.modelId !== event.modelId) return doc
  const next: GenerateNode = {
    ...node,
    modelLabel: event.modelLabel,
    contract,
    values: mergeContractValues(node.values, contract.settings),
    inline: keepInline(node.inline, contract.inputs)
  }
  return pruneEdges(
    mapNode(doc, node.id, () => next),
    node.id
  )
}

function applyAppContract(
  doc: SuperGraphDocument,
  event: { nodeId: NodeId; workflowPath: string; title: string },
  contract: AppContract
): SuperGraphDocument {
  const node = findNode(doc, event.nodeId)
  if (node?.kind !== 'app' || node.workflowPath !== event.workflowPath) {
    return doc
  }
  const next: AppNode = {
    ...node,
    title: event.title,
    contract,
    values: mergeContractValues(node.values, contract.settings),
    inline: seedAppInline(
      keepInline(node.inline, contract.inputs),
      node.contract,
      contract
    )
  }
  return pruneEdges(
    mapNode(doc, node.id, () => next),
    node.id
  )
}

function connectEdge(
  doc: SuperGraphDocument,
  event: Extract<EditEvent, { type: 'edgeConnected' }>
): SuperGraphDocument {
  const outcome = canConnect(doc, event.from, event.to)
  if (!outcome.ok) return doc
  const kept = doc.edges.filter((edge) => edge.id !== outcome.replaces)
  return {
    ...doc,
    edges: [
      ...kept,
      { id: event.id, seq: doc.nextSeq, from: event.from, to: event.to }
    ],
    nextSeq: doc.nextSeq + 1
  }
}

function addItems(
  items: MediaItem[],
  added: MediaItem[],
  mode: 'append' | 'replace'
): MediaItem[] {
  return mode === 'append' ? [...items, ...added] : added
}

function changeText(
  items: MediaItem[],
  index: number,
  text: string
): MediaItem[] {
  return items.map((item, position) =>
    position === index && item.kind === 'text' ? textItem(text) : item
  )
}

function setValue(
  values: Record<string, SettingValue>,
  name: string,
  value: SettingValue | null
): Record<string, SettingValue> {
  if (value === null || value === '') return withoutKey(values, name)
  return { ...values, [name]: value }
}

function setInline(
  inline: Record<string, string>,
  port: string,
  text: string
): Record<string, string> {
  return text === '' ? withoutKey(inline, port) : { ...inline, [port]: text }
}

function clampRunCount(runCount: number): number {
  return Number.isFinite(runCount) ? Math.max(1, Math.floor(runCount)) : 1
}

function nodeUpdater(event: NodeEdit): (node: SuperNode) => SuperNode {
  switch (event.type) {
    case 'itemsAdded':
      return onIo((node) => ({
        ...node,
        items: addItems(node.items, event.items, event.mode)
      }))
    case 'itemRemoved':
      return onIo((node) => ({
        ...node,
        items: node.items.filter((_, position) => position !== event.index)
      }))
    case 'textItemChanged':
      return onIo((node) => ({
        ...node,
        items: changeText(node.items, event.index, event.text)
      }))
    case 'valueChanged':
      return onExecutable((node) => ({
        ...node,
        values: setValue(node.values, event.name, event.value)
      }))
    case 'inlineChanged':
      return onExecutable((node) => ({
        ...node,
        inline: setInline(node.inline, event.port, event.text)
      }))
    case 'runCountChanged':
      return onExecutable((node) => ({
        ...node,
        runCount: clampRunCount(event.runCount)
      }))
    case 'settingsToggled':
      return onExecutable((node) => ({
        ...node,
        settingsOpen: !node.settingsOpen
      }))
    case 'modelPicked':
      return (node) =>
        node.kind === 'generate'
          ? { ...node, modelId: event.modelId, contract: null }
          : node
  }
}

function reduceGraphEdit(
  doc: SuperGraphDocument,
  event: GraphEdit
): SuperGraphDocument {
  switch (event.type) {
    case 'nodeAdded':
      return findNode(doc, event.node.id)
        ? doc
        : { ...doc, nodes: [...doc.nodes, event.node] }
    case 'nodesMoved':
      return {
        ...doc,
        nodes: doc.nodes.map((node) => {
          const move = event.moves.find(({ id }) => id === node.id)
          return move ? { ...node, x: move.x, y: move.y } : node
        })
      }
    case 'edgeConnected':
      return connectEdge(doc, event)
    case 'edgesRemoved':
      return {
        ...doc,
        edges: doc.edges.filter(({ id }) => !event.edgeIds.includes(id))
      }
    case 'modelContractResolved':
      return applyModelContract(doc, event, event.contract)
    case 'appContractResolved':
      return applyAppContract(doc, event, event.contract)
    case 'viewportChanged':
      return { ...doc, viewport: event.viewport }
  }
}

function removeNodes(
  state: SuperComfyState,
  nodeIds: readonly NodeId[]
): SuperComfyState {
  const removed = new Set(nodeIds)
  const { doc, runtime } = state
  return {
    doc: {
      ...doc,
      nodes: doc.nodes.filter(({ id }) => !removed.has(id)),
      edges: doc.edges.filter(
        ({ from, to }) => !removed.has(from.node) && !removed.has(to.node)
      )
    },
    runtime: {
      ...runtime,
      activity: Object.fromEntries(
        Object.entries(runtime.activity).filter(([id]) => !removed.has(id))
      )
    }
  }
}

function startSession(
  state: SuperComfyState,
  session: RunSession
): SuperComfyState {
  const waiting = Object.fromEntries(
    session.nodeIds.map((id): [NodeId, NodeActivity] => [
      id,
      { phase: 'waiting', sessionId: session.id }
    ])
  )
  return {
    ...state,
    runtime: {
      sessions: { ...state.runtime.sessions, [session.id]: session },
      activity: { ...state.runtime.activity, ...waiting }
    }
  }
}

const RELEASED_PHASES = new Set<NodeActivity['phase']>([
  'waiting',
  'running',
  'upToDate'
])

function releaseSession(
  state: SuperComfyState,
  sessionId: SessionId
): SuperComfyState {
  const activity = Object.fromEntries(
    Object.entries(state.runtime.activity).map(
      ([id, current]): [NodeId, NodeActivity] =>
        sessionOf(current) === sessionId && RELEASED_PHASES.has(current.phase)
          ? [id, { phase: 'idle' }]
          : [id, current]
    )
  )
  return {
    ...state,
    runtime: {
      sessions: withoutKey(state.runtime.sessions, sessionId),
      activity
    }
  }
}

function updateSlot(
  state: SuperComfyState,
  nodeId: NodeId,
  index: number,
  update: (slot: RunSlot) => RunSlot
): SuperComfyState {
  const activity = activityOf(state, nodeId)
  if (activity.phase !== 'running') return state
  return setActivity(state, nodeId, {
    ...activity,
    slots: activity.slots.map((slot) =>
      slot.index === index ? update(slot) : slot
    )
  })
}

function initialSlots(planKeys: RunKey[], cachedIndices: number[]): RunSlot[] {
  const cached = new Set(cachedIndices)
  return planKeys.map((key, index) => ({
    key,
    index,
    state: cached.has(index) ? 'cached' : 'queued'
  }))
}

function recordSuccess(
  state: SuperComfyState,
  event: Extract<RunEvent, { type: 'runSucceeded' }>
): SuperComfyState {
  const { nodeId, record, sessionId } = event
  const node = findNode(state.doc, nodeId)
  if (!node || node.kind === 'io') return state
  const owned = owns(state, nodeId, sessionId)
  if (!owned && Object.hasOwn(node.runs, record.key)) return state
  const next = withDoc(
    state,
    mapNode(
      state.doc,
      nodeId,
      onExecutable((current) => ({
        ...current,
        runs: { ...current.runs, [record.key]: record }
      }))
    )
  )
  if (!owned) return next
  return updateSlot(next, nodeId, record.index, (slot) => ({
    ...slot,
    state: 'done'
  }))
}

function recordsFor(
  node: ExecutableNode,
  planKeys: RunKey[],
  slots: RunSlot[]
): RunRecord[] {
  const failed = new Set(
    slots.filter(({ state }) => state === 'failed').map(({ index }) => index)
  )
  return planKeys
    .filter((key, index) => !failed.has(index) && Object.hasOwn(node.runs, key))
    .map((key) => node.runs[key])
}

function concatOutputs(records: RunRecord[]): Record<string, MediaItem[]> {
  return records.reduce<Record<string, MediaItem[]>>((outputs, record) => {
    const merged = Object.entries(record.outputs).map(([port, items]) => [
      port,
      [...(Object.hasOwn(outputs, port) ? outputs[port] : []), ...items]
    ])
    return { ...outputs, ...Object.fromEntries(merged) }
  }, {})
}

export function materializeResult(
  node: ExecutableNode,
  planKeys: RunKey[],
  slots: RunSlot[],
  at: number
): NodeResult {
  const records = recordsFor(node, planKeys, slots)
  const failures = slots
    .filter(({ state }) => state === 'failed')
    .map(({ key, index, message, code }) => ({ key, index, message, code }))
  const complete = failures.length === 0 && records.length === planKeys.length
  const someRecords = records.length > 0 ? 'partial' : 'failed'
  return {
    planKeys,
    outputs: concatOutputs(records),
    failures,
    status: complete ? 'complete' : someRecords,
    finishedAt: at
  }
}

function commitNode(
  state: SuperComfyState,
  nodeId: NodeId,
  at: number
): SuperComfyState {
  const activity = activityOf(state, nodeId)
  if (activity.phase !== 'running') return state
  const planKeys = activity.slots.map(({ key }) => key)
  const doc = mapNode(
    state.doc,
    nodeId,
    onExecutable((node) => {
      const result = materializeResult(node, planKeys, activity.slots, at)
      const kept = recordsFor(node, planKeys, activity.slots)
      return {
        ...node,
        result,
        runs: Object.fromEntries(kept.map((record) => [record.key, record]))
      }
    })
  )
  return setActivity(withDoc(state, doc), nodeId, { phase: 'idle' })
}

export function collectIoItems(
  doc: SuperGraphDocument,
  ioId: NodeId
): MediaItem[] {
  return incomingEdges(doc, ioId, 'in').flatMap((edge) =>
    sourceItems(doc, edge)
  )
}

function collectIo(
  state: SuperComfyState,
  nodeId: NodeId,
  sessionId: SessionId
): SuperComfyState {
  const items = collectIoItems(state.doc, nodeId)
  const collected = withDoc(
    state,
    mapNode(
      state.doc,
      nodeId,
      onIo((node) => ({ ...node, items }))
    )
  )
  return owns(state, nodeId, sessionId)
    ? setActivity(collected, nodeId, { phase: 'idle' })
    : collected
}

function sessionLists(
  state: SuperComfyState,
  nodeId: NodeId,
  sessionId: SessionId
): boolean {
  const { sessions } = state.runtime
  return (
    Object.hasOwn(sessions, sessionId) &&
    sessions[sessionId].nodeIds.includes(nodeId)
  )
}

function reduceOwnedRun(
  state: SuperComfyState,
  event: OwnedRunEvent
): SuperComfyState {
  const { nodeId, sessionId } = event
  switch (event.type) {
    case 'nodeBlocked':
      return setActivity(state, nodeId, {
        phase: 'blocked',
        sessionId,
        block: event.block
      })
    case 'nodeUpToDate':
      return setActivity(state, nodeId, { phase: 'upToDate', sessionId })
    case 'nodeStarted':
      return setActivity(state, nodeId, {
        phase: 'running',
        sessionId,
        slots: initialSlots(event.planKeys, event.cachedIndices)
      })
    case 'runStarted':
      return updateSlot(state, nodeId, event.index, (slot) => ({
        ...slot,
        state: 'running'
      }))
    case 'runProgressed':
      return updateSlot(state, nodeId, event.index, (slot) => ({
        ...slot,
        queuePosition: event.queuePosition,
        fraction: event.fraction
      }))
    case 'runFailed':
      return updateSlot(state, nodeId, event.index, (slot) => ({
        ...slot,
        state: 'failed',
        message: event.message,
        code: event.code
      }))
    case 'nodeCommitted':
      return commitNode(state, nodeId, event.at)
    case 'ioCollected':
      return collectIo(state, nodeId, sessionId)
  }
}

function reduceSessionRun(
  state: SuperComfyState,
  event: SessionRunEvent
): SuperComfyState {
  if (event.type === 'runSucceeded') return recordSuccess(state, event)
  const { nodeId, sessionId } = event
  const applies =
    owns(state, nodeId, sessionId) ||
    (event.type === 'ioCollected' && sessionLists(state, nodeId, sessionId))
  if (!applies) return state
  return reduceOwnedRun(state, event)
}

function reduceRun(state: SuperComfyState, event: RunEvent): SuperComfyState {
  switch (event.type) {
    case 'sessionStarted':
      return startSession(state, event.session)
    case 'sessionStopped':
      return releaseSession(state, event.sessionId)
    case 'sessionEnded':
      return releaseSession(state, event.sessionId)
    case 'runRefused':
      return setActivity(state, event.nodeId, {
        phase: 'blocked',
        sessionId: null,
        block: event.block
      })
    default:
      return reduceSessionRun(state, event)
  }
}

export function reduceSuperComfy(
  state: SuperComfyState,
  event: SuperComfyEvent
): SuperComfyState {
  if (event.type === 'documentLoaded') {
    return { doc: event.doc, runtime: initialRuntime() }
  }
  if (event.type === 'nodesRemoved') return removeNodes(state, event.nodeIds)
  if (isRunEvent(event)) return reduceRun(state, event)
  if (isNodeEdit(event)) {
    return withDoc(state, mapNode(state.doc, event.nodeId, nodeUpdater(event)))
  }
  return withDoc(state, reduceGraphEdit(state.doc, event))
}
