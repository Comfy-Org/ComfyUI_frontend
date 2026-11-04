import { PromptExecutionError } from '@comfyorg/api-client/ComfyApi'
import type { PromptFailureResponse } from '@comfyorg/api-client/types'
import { isNodeExecutionId } from '@comfyorg/graph-model/nodeIdentification'
import type {
  ComfyApiWorkflow,
  ComfyWorkflowJSON
} from '@comfyorg/graph-model/workflowSchema'
import { reportError } from '@comfyorg/telemetry/reportError'
import { Mutex } from 'es-toolkit'

import { t } from '@/i18n'
import type {
  PartnerCredentials,
  PartnerCredentialsOutcome
} from '@/platform/auth/partnerNode/partnerNodeQueueCredentials'
import {
  queuePromptAs,
  resolvePartnerCredentials,
  workspaceDrifted
} from '@/platform/auth/partnerNode/partnerNodeQueueCredentials'
import { useSettingStore } from '@/platform/settings/settingStore'
import type { ComfyWorkflow } from '@/platform/workflow/management/stores/comfyWorkflow'
import {
  collectRunOutputs,
  hasRunOutputs
} from '@/renderer/extensions/superComfy/apps/appOutputs'
import {
  bindRunValues,
  rewriteBoundOutputs,
  runQueueHooks
} from '@/renderer/extensions/superComfy/apps/appPrompt'
import {
  appFailureMessage,
  errorDetail,
  loadAppSource
} from '@/renderer/extensions/superComfy/apps/appSource'
import { watchCloudJob } from '@/renderer/extensions/superComfy/apps/cloudJobWatcher'
import type { DetachedAppGraph } from '@/renderer/extensions/superComfy/apps/detachedAppGraph'
import { openDetachedAppGraph } from '@/renderer/extensions/superComfy/apps/detachedAppGraph'
import type {
  AppContract,
  AppNode,
  MediaItem
} from '@/renderer/extensions/superComfy/engine/documentSchema'
import type {
  Executor,
  NodeExecution,
  PlannedRun,
  RunOutcome,
  RunRequest
} from '@/renderer/extensions/superComfy/engine/types'
import {
  persistBlob,
  readItemBytes
} from '@/renderer/extensions/superComfy/media/superMedia'
import { useExecutionStore } from '@/stores/executionStore'
import { normalizePromptError } from '@/utils/executionErrorUtil'
import { graphToPrompt } from '@/utils/executionUtil'

type Failure = { ok: false; message: string }

interface PreparedApp {
  detached: DetachedAppGraph
  workflow: ComfyWorkflow
  rootId: string | undefined
  credentials: PartnerCredentials
}

type Preparation = { ok: true; app: PreparedApp } | Failure
type ItemHosting = { ok: true; item: MediaItem } | Failure
type InputHosting = { ok: true; inputs: PlannedRun['inputs'] } | Failure
type Submission = { ok: true; promptId: string } | Failure
type BuiltPrompt =
  | { ok: true; output: ComfyApiWorkflow; workflow: ComfyWorkflowJSON }
  | Failure

const APP_CONCURRENCY = 4

function failure(message: string): Failure {
  return { ok: false, message }
}

function credentialsFailure(
  outcome: Exclude<PartnerCredentialsOutcome, { ok: true }>
): Failure {
  return failure(
    outcome.reason === 'notSignedIn'
      ? t('superComfy.app.notSignedIn')
      : errorDetail(outcome.error)
  )
}

function reportPrepareError(cause: unknown) {
  reportError(cause, {
    errorType: 'error_preparing_supercomfy_app',
    surface: 'graph'
  })
}

async function prepareApp(node: AppNode): Promise<Preparation> {
  const source = await loadAppSource(node.workflowPath)
  if (!source.ok) return failure(appFailureMessage(source))
  const credentials = await resolvePartnerCredentials()
  if (!credentials.ok) return credentialsFailure(credentials)
  const opening = openDetachedAppGraph(source.json)
  if (!opening.ok) {
    reportPrepareError(opening.cause)
    return failure(t('superComfy.app.prepareFailed'))
  }
  return {
    ok: true,
    app: {
      detached: opening.detached,
      workflow: source.workflow,
      rootId: source.json.id,
      credentials: credentials.credentials
    }
  }
}

function linkFileName(url: string): string {
  const [path] = url.split(/[?#]/)
  return path.split('/').pop() || 'supercomfy-input'
}

async function rehostLink(
  item: Extract<MediaItem, { kind: 'link' }>,
  signal: AbortSignal
): Promise<ItemHosting> {
  const bytes = await readItemBytes(item, signal)
  if (!bytes.ok) {
    return failure(
      t(
        bytes.reason === 'expired'
          ? 'superComfy.media.expired'
          : 'superComfy.media.unreadable'
      )
    )
  }
  const persisted = await persistBlob(
    bytes.blob,
    linkFileName(item.url),
    item.modality
  )
  if (!persisted.ok) {
    return failure(
      t('superComfy.media.uploadFailed', { reason: persisted.reason })
    )
  }
  return { ok: true, item: persisted.item }
}

function createInputHost(signal: AbortSignal) {
  const rehosted = new Map<string, Promise<ItemHosting>>()
  const hostItem = (item: MediaItem): Promise<ItemHosting> => {
    if (item.kind !== 'link') return Promise.resolve({ ok: true, item })
    const pending = rehosted.get(item.url) ?? rehostLink(item, signal)
    rehosted.set(item.url, pending)
    return pending
  }
  return async (inputs: PlannedRun['inputs']): Promise<InputHosting> => {
    const ports = await Promise.all(
      Object.entries(inputs).map(async ([port, items]) => ({
        port,
        hosted: await Promise.all(items.map(hostItem))
      }))
    )
    const failed = ports
      .flatMap(({ hosted }) => hosted)
      .find((hosting): hosting is Failure => !hosting.ok)
    if (failed) return failed
    return {
      ok: true,
      inputs: Object.fromEntries(
        ports.map(({ port, hosted }) => [
          port,
          hosted.flatMap((hosting) => (hosting.ok ? [hosting.item] : []))
        ])
      )
    }
  }
}

function firstNodeErrorText(
  response: PromptFailureResponse,
  output: ComfyApiWorkflow
): string | undefined {
  const first = Object.entries(response.node_errors ?? {}).at(0)
  if (!first) return undefined
  const [nodeId, nodeError] = first
  const title = output[nodeId]?._meta?.title ?? nodeError.class_type
  const reason = nodeError.errors.at(0)?.message
  return reason ? `${title}: ${reason}` : title
}

function submitFailureMessage(
  error: unknown,
  output: ComfyApiWorkflow
): string {
  if (!(error instanceof PromptExecutionError)) return errorDetail(error)
  const base =
    normalizePromptError(error.response.error)?.message || error.message
  const nodeError = firstNodeErrorText(error.response, output)
  return nodeError ? `${base} (${nodeError})` : base
}

async function buildPrompt(app: PreparedApp): Promise<BuiltPrompt> {
  try {
    const prompt = await graphToPrompt(app.detached.graph, {
      sortNodes: useSettingStore().get('Comfy.Workflow.SortNodeIdOnSave')
    })
    return {
      ok: true,
      output: prompt.output,
      workflow: { ...prompt.workflow, id: app.rootId ?? prompt.workflow.id }
    }
  } catch (cause) {
    reportPrepareError(cause)
    return failure(errorDetail(cause))
  }
}

async function submitPrompt(
  app: PreparedApp,
  prompt: { output: ComfyApiWorkflow; workflow: ComfyWorkflowJSON },
  outputIds: readonly string[]
): Promise<Submission> {
  try {
    const response = await queuePromptAs(app.credentials, prompt, {
      partialExecutionTargets: outputIds.filter(isNodeExecutionId)
    })
    if (!response.prompt_id) return failure(t('superComfy.app.runFailed'))
    return { ok: true, promptId: response.prompt_id }
  } catch (error) {
    return failure(submitFailureMessage(error, prompt.output))
  }
}

async function queueBoundRun(
  app: PreparedApp,
  contract: AppContract
): Promise<Submission> {
  const built = await buildPrompt(app)
  if (!built.ok) return built
  if (workspaceDrifted(app.credentials)) {
    return failure(t('superComfy.app.workspaceChanged'))
  }
  const outputIds = contract.outputs.map((port) => port.outputNodeId)
  const runTag = crypto.randomUUID().slice(0, 8)
  const submitted = await submitPrompt(
    app,
    {
      workflow: built.workflow,
      output: rewriteBoundOutputs(built.output, outputIds, runTag)
    },
    outputIds
  )
  if (submitted.ok) {
    useExecutionStore().registerJobOwner(submitted.promptId, app.workflow)
  }
  return submitted
}

async function submitRun(
  app: PreparedApp,
  node: AppNode,
  contract: AppContract,
  run: PlannedRun
): Promise<Submission> {
  const { graph } = app.detached
  if (!bindRunValues(graph, node, run)) {
    return failure(t('superComfy.app.prepareFailed'))
  }
  runQueueHooks(graph, 'beforeQueued')
  try {
    return await queueBoundRun(app, contract)
  } finally {
    runQueueHooks(graph, 'afterQueued')
  }
}

function beginAppExecution(
  node: AppNode,
  contract: AppContract,
  signal: AbortSignal
): NodeExecution {
  const mutex = new Mutex()
  const hostInputs = createInputHost(signal)
  let preparation: Promise<Preparation> | undefined

  async function submitInOrder(request: RunRequest): Promise<Submission> {
    await mutex.acquire()
    try {
      const hosted = await hostInputs(request.run.inputs)
      if (!hosted.ok) return hosted
      if (request.signal.aborted) return failure(t('superComfy.app.cancelled'))
      preparation ??= prepareApp(node)
      const prepared = await preparation
      if (!prepared.ok) return prepared
      return await submitRun(prepared.app, node, contract, {
        ...request.run,
        inputs: hosted.inputs
      })
    } finally {
      mutex.release()
    }
  }

  return {
    async run(request): Promise<RunOutcome> {
      const submitted = await submitInOrder(request)
      if (!submitted.ok) return submitted
      const watched = await watchCloudJob({
        promptId: submitted.promptId,
        signal: request.signal,
        onProgress: (fraction) => request.onProgress({ fraction }),
        hasOutputs: (detail) => hasRunOutputs(contract, detail.outputs)
      })
      if (!watched.ok) return watched
      return {
        ok: true,
        outputs: collectRunOutputs(contract, watched.detail.outputs)
      }
    },
    async dispose() {
      const prepared = await preparation
      if (prepared?.ok) prepared.app.detached.dispose()
    }
  }
}

function unpreparedExecution(): NodeExecution {
  return {
    run: () => Promise.resolve(failure(t('superComfy.app.prepareFailed'))),
    dispose: () => Promise.resolve()
  }
}

export function createAppExecutor(): Executor {
  return {
    concurrency: APP_CONCURRENCY,
    begin: (node, signal) =>
      node.kind === 'app' && node.contract
        ? beginAppExecution(node, node.contract, signal)
        : unpreparedExecution()
  }
}
