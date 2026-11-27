import {
  awaitWithAbort,
  combineAbortSignals,
  createTimeoutSignal,
  throwIfAborted
} from '@comfyorg/api-client/abortSignal'
import type { IBaseWidget } from '@comfyorg/graph-model/widgets'
import type {
  CloudWorkflowCompatibility,
  CompatibilityModel
} from '@comfyorg/ingest-types'
import { zCheckCloudCompatibilityResponse } from '@comfyorg/ingest-types/zod'
import { reportError } from '@comfyorg/telemetry/reportError'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import type {
  ExecutableLGraphNode,
  ExecutionId,
  LGraph
} from '@/lib/litegraph/src/litegraph'
import {
  ExecutableNodeDTO,
  isComboWidget,
  LGraphEventMode
} from '@/lib/litegraph/src/litegraph'
import { useApp } from '@/scripts/appInstance'
import { useAuthStore } from '@/stores/authStore'
import { useModelStore } from '@/stores/modelStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'
import { isModelFileName } from '@/platform/workflowErrors/missingModel/missingModelScan'
import { matchesWidgetName } from '@/utils/widgetBinding'
import type {
  CloudCheckFailureReason,
  CloudWorkflowBlocker,
  CloudWorkflowCheckResult,
  UncheckedModelInput
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import { trustedCloudHandoffOrigin } from '@/platform/openOnCloud/localHandoffProtocol'

const LINKED = Symbol('linked')

type CheckedNode = {
  class_type: string
  inputs: Record<string, unknown>
  pickerInputs: Map<string, IBaseWidget>
  hasUnreadableModels: boolean
}

const PICKER_WIDGET_TYPES = new Set(['combo', 'asset'])

function isSkippedByExecution(mode: LGraphEventMode | undefined): boolean {
  return mode === LGraphEventMode.NEVER || mode === LGraphEventMode.BYPASS
}

function executableNodes(graph: LGraph): ExecutableLGraphNode[] {
  const byId = new Map<ExecutionId, ExecutableLGraphNode>()
  for (const node of graph.nodes) {
    const dto = new ExecutableNodeDTO(node, [], byId)
    byId.set(dto.id, dto)
    if (isSkippedByExecution(node.mode)) continue
    for (const inner of dto.getInnerNodes()) byId.set(inner.id, inner)
  }
  return [...byId.values()].filter(
    (node) => !node.isVirtualNode && !isSkippedByExecution(node.mode)
  )
}

function nodeType(node: ExecutableLGraphNode): string {
  const source = node instanceof ExecutableNodeDTO ? node.node : null
  return source?.last_serialization?.type ?? node.comfyClass ?? node.type
}

function nodeInputs(node: ExecutableLGraphNode): Record<string, unknown> {
  const widgets = (node.widgets ?? []).filter(
    (widget) => widget.name && widget.options.serialize !== false
  )
  const inputs: Record<string, unknown> = Object.fromEntries(
    widgets.map((widget) => [widget.name, widget.value])
  )
  for (const [slot, input] of node.inputs.entries()) {
    const resolved = node.resolveInput(slot)
    if (!resolved) continue
    inputs[input.name] = resolved.widgetInfo
      ? resolved.widgetInfo.value
      : LINKED
  }
  return inputs
}

function pickerInputs(node: ExecutableLGraphNode): Map<string, IBaseWidget> {
  const widgets = (node.widgets ?? []).filter((widget) =>
    PICKER_WIDGET_TYPES.has(widget.type)
  )
  return new Map(widgets.map((widget) => [widget.name, widget]))
}

function isPossibleLinkedModel(widget: IBaseWidget | undefined): boolean {
  if (!widget) return false
  if (!isComboWidget(widget)) return true
  const { values } = widget.options
  return !(
    Array.isArray(values) &&
    values.length > 0 &&
    values.every(
      (option) =>
        typeof option === 'number' ||
        (typeof option === 'string' && !isModelFileName(option))
    )
  )
}

function hasUnreadableModels(node: ExecutableLGraphNode): boolean {
  if (node.comfyClass || !(node instanceof ExecutableNodeDTO)) return false
  const values: unknown = node.node.last_serialization?.widgets_values
  const saved = Array.isArray(values)
    ? values
    : values && typeof values === 'object'
      ? Object.values(values)
      : []
  return saved.some(
    (value) => typeof value === 'string' && isModelFileName(value)
  )
}

function checkedNodes(graph: LGraph): CheckedNode[] {
  return executableNodes(graph).map((node) => ({
    class_type: nodeType(node),
    inputs: nodeInputs(node),
    pickerInputs: pickerInputs(node),
    hasUnreadableModels: hasUnreadableModels(node)
  }))
}

function modelInputsByNodeType() {
  const store = useModelToNodeStore()
  store.registerDefaults()
  const inputs = new Map<string, [folder: string, key: string | RegExp][]>()
  for (const [folder, providers] of Object.entries(store.modelToNodeMap)) {
    for (const { nodeDef, key } of providers ?? []) {
      const entries = inputs.get(nodeDef.name) ?? []
      inputs.set(nodeDef.name, [...entries, [folder, key]])
    }
  }
  return inputs
}

async function localModelFolders(): Promise<Map<string, string | null>> {
  const folders = await useModelStore().loadModels()
  const folderByName = new Map<string, string | null>()
  for (const folder of folders) {
    for (const model of Object.values(folder.models)) {
      const known = folderByName.get(model.file_name)
      folderByName.set(
        model.file_name,
        known === undefined || known === folder.directory
          ? folder.directory
          : null
      )
    }
  }
  return folderByName
}

function loaderFolders(
  loaderInputs: [folder: string, key: string | RegExp][],
  input: string
): string[] {
  return loaderInputs
    .filter(([, key]) => matchesWidgetName(input, key))
    .map(([folder]) => folder)
}

type UnmappedModel = UncheckedModelInput & { name: string }

type ModelScan = {
  mapped: CompatibilityModel[]
  unmapped: UnmappedModel[]
  unchecked: Map<string, UncheckedModelInput>
}

function markUnchecked(
  scan: ModelScan,
  { nodeType, input }: UncheckedModelInput
) {
  scan.unchecked.set(JSON.stringify([nodeType, input]), { nodeType, input })
}

function scanNode(
  node: CheckedNode,
  loaderInputs: [folder: string, key: string | RegExp][],
  scan: ModelScan
) {
  for (const [input, value] of Object.entries(node.inputs)) {
    const folders = loaderFolders(loaderInputs, input)
    const picker = node.pickerInputs.get(input)
    if (value === LINKED) {
      if (folders.length || isPossibleLinkedModel(picker))
        markUnchecked(scan, { nodeType: node.class_type, input })
      continue
    }
    if (typeof value !== 'string') continue
    scan.mapped.push(...folders.map((folder) => ({ folder, name: value })))
    if (!folders.length && picker && isModelFileName(value))
      scan.unmapped.push({ nodeType: node.class_type, input, name: value })
  }
}

function scanModelInputs(nodes: CheckedNode[]): ModelScan {
  const inputsByType = modelInputsByNodeType()
  const scan: ModelScan = { mapped: [], unmapped: [], unchecked: new Map() }
  for (const node of nodes)
    scanNode(node, inputsByType.get(node.class_type) ?? [], scan)
  return scan
}

async function resolveUnmapped(scan: ModelScan): Promise<CompatibilityModel[]> {
  if (!scan.unmapped.length) return []
  const folderByName = await localModelFolders()
  return scan.unmapped.flatMap((model) => {
    const folder = folderByName.get(model.name)
    if (folder) return [{ folder, name: model.name }]
    markUnchecked(scan, model)
    return []
  })
}

type CollectedModels = {
  models: CompatibilityModel[]
  unchecked: UncheckedModelInput[]
}

async function collectModels(nodes: CheckedNode[]): Promise<CollectedModels> {
  const scan = scanModelInputs(nodes)
  const resolved = await resolveUnmapped(scan)
  const models = new Map<string, CompatibilityModel>()
  for (const model of [...scan.mapped, ...resolved])
    models.set(JSON.stringify([model.folder, model.name]), model)
  return {
    models: [...models.values()],
    unchecked: [...scan.unchecked.values()]
  }
}

async function compatibilityAuth(expectedWorkspaceId?: string) {
  const authStore = useAuthStore()
  const { flags } = useFeatureFlags()
  if (!expectedWorkspaceId && !flags.openOnCloudModelUploadEnabled)
    return {
      ok: true,
      headers: await authStore.getAuthHeader(),
      workspaceId: undefined
    } as const

  const { isApiKeyLogin, isLoggedIn } = useCurrentUser()
  const requireWorkspace =
    !!expectedWorkspaceId || (isLoggedIn.value && !isApiKeyLogin.value)
  const { headers, workspaceId } = await authStore.getWorkspaceAuthContext({
    requireWorkspace
  })
  if (expectedWorkspaceId && workspaceId !== expectedWorkspaceId)
    return { ok: false } as const
  if (
    (requireWorkspace && !workspaceId) ||
    (!headers && (requireWorkspace || isLoggedIn.value))
  )
    return { ok: false } as const
  return {
    ok: true,
    headers,
    workspaceId: headers ? workspaceId : undefined
  } as const
}

type CheckFailure = Extract<CloudWorkflowBlocker, { kind: 'checkFailed' }>

type CompatibilityAnswer = {
  cloud: CloudWorkflowCompatibility
  workspaceId: string | undefined
}

async function readJson(
  response: Response,
  signal: AbortSignal
): Promise<unknown> {
  try {
    return await response.json()
  } catch (error) {
    if (signal.aborted) throw error
    return undefined
  }
}

function stringField(body: unknown, field: 'code' | 'message') {
  if (!body || typeof body !== 'object' || !(field in body)) return undefined
  const value: unknown = Reflect.get(body, field)
  return typeof value === 'string' ? value : undefined
}

async function refusalReason(
  response: Response,
  signal: AbortSignal
): Promise<CloudCheckFailureReason> {
  const { status } = response
  if (status === 413) return 'tooBig'
  if (status === 408 || status === 429 || status >= 500) return 'busy'
  if (status === 401 || status === 403) return 'workspace'
  if (status !== 400 && status !== 404) return 'outdated'
  const body = await readJson(response, signal)
  const code = stringField(body, 'code')
  if (status === 404) return code === 'NOT_FOUND' ? 'switchedOff' : 'busy'
  if (code === 'workspace_id_invalid') return 'workspace'
  return stringField(body, 'message')?.startsWith('at most ')
    ? 'tooBig'
    : 'outdated'
}

async function requestCompatibility(
  nodeTypes: string[],
  models: CompatibilityModel[],
  { workspaceId, signal }: { workspaceId?: string; signal?: AbortSignal } = {}
): Promise<CompatibilityAnswer | CheckFailure | null> {
  const timeout = createTimeoutSignal(10_000)
  try {
    const origin = trustedCloudHandoffOrigin()
    if (!origin)
      return giveUp('unreachable', new Error('Cloud API origin unavailable'))
    const requestSignal = signal
      ? combineAbortSignals([signal, timeout])
      : timeout
    throwIfAborted(requestSignal)
    const auth = await awaitWithAbort(
      compatibilityAuth(workspaceId).catch(
        (cause: unknown) => ({ ok: false, cause }) as const
      ),
      requestSignal
    )
    throwIfAborted(requestSignal)
    if (!auth.ok)
      return giveUp(
        'workspace',
        'cause' in auth
          ? auth.cause
          : new Error('Workspace authorization unavailable')
      )
    const response = await fetch(new URL('/api/cloud/compatibility', origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...auth.headers },
      body: JSON.stringify({ node_types: nodeTypes, models }),
      redirect: 'error',
      signal: requestSignal
    })
    if (!response.ok)
      return giveUp(
        await refusalReason(response, requestSignal),
        new Error(`Cloud compatibility returned ${response.status}`)
      )
    const parsed = zCheckCloudCompatibilityResponse.safeParse(
      await readJson(response, requestSignal)
    )
    if (!parsed.success) return giveUp('outdated', parsed.error)
    return { cloud: parsed.data.cloud, workspaceId: auth.workspaceId }
  } catch (error) {
    if (signal?.aborted) return null
    return giveUp(timeout.aborted ? 'busy' : 'unreachable', error)
  }
}

export async function readCloudMissingModels(
  models: CompatibilityModel[],
  workspaceId: string,
  signal?: AbortSignal
) {
  const verdict = await requestCompatibility([], models, {
    workspaceId,
    signal
  })
  return verdict && 'cloud' in verdict
    ? (verdict.cloud.missing_models ?? null)
    : null
}

function giveUp(reason: CloudCheckFailureReason, cause: unknown): CheckFailure {
  if (reason !== 'switchedOff')
    reportError(cause, {
      errorType: 'failure_checking_cloud_compatibility',
      surface: 'platform'
    })
  return { kind: 'checkFailed', reason }
}

function workflowVerdict(
  verdict: CloudWorkflowCompatibility,
  requireModelVerdict: boolean,
  unchecked: UncheckedModelInput[],
  workspaceId?: string
): CloudWorkflowCheckResult {
  const { missing_node_types: nodePacks, missing_models: models } = verdict
  if (nodePacks.length || models?.length)
    return { kind: 'missing', gaps: { nodePacks, models: models ?? [] } }
  if (requireModelVerdict && models === undefined)
    return giveUp(
      'outdated',
      new Error('Cloud compatibility omitted the model verdict')
    )
  return {
    kind: 'canOpen',
    ...(workspaceId && { workspaceId }),
    ...(unchecked.length > 0 && { uncheckedInputs: unchecked })
  }
}

export interface ConfirmedWorkspaceModels {
  workspaceId: string
  models: readonly CompatibilityModel[]
}

/** Resolves null when no verdict is available. */
export async function checkCloudCompatibility(
  confirmedUploads?: ConfirmedWorkspaceModels,
  signal?: AbortSignal
): Promise<CloudWorkflowCheckResult> {
  try {
    throwIfAborted(signal)
    const nodes = checkedNodes(useApp().rootGraph)
    if (!nodes.length) return { kind: 'emptyWorkflow' }
    const unreadableLoader = nodes.find((node) => node.hasUnreadableModels)
    if (unreadableLoader)
      return {
        kind: 'unreadableModelLoader',
        nodeType: unreadableLoader.class_type
      }
    const { models, unchecked } = await awaitWithAbort(
      collectModels(nodes),
      signal
    )
    throwIfAborted(signal)
    const nodeTypes = [...new Set(nodes.map((node) => node.class_type))]
    const workspaceId = confirmedUploads?.models.some((uploaded) =>
      models.some(
        ({ folder, name }) =>
          folder === uploaded.folder && name === uploaded.name
      )
    )
      ? confirmedUploads.workspaceId
      : undefined
    const verdict = await requestCompatibility(nodeTypes, models, {
      workspaceId,
      signal
    })
    if (!verdict || !('cloud' in verdict)) return verdict
    const requireModelVerdict =
      models.length > 0 &&
      (verdict.workspaceId !== undefined ||
        useFeatureFlags().flags.openOnCloudModelUploadEnabled)
    return workflowVerdict(
      verdict.cloud,
      requireModelVerdict,
      unchecked,
      verdict.workspaceId
    )
  } catch (error) {
    if (signal?.aborted) return null
    return giveUp('unreadable', error)
  }
}
