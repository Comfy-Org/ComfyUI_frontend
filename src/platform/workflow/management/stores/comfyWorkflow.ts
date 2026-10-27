import { markRaw } from 'vue'

import { assert } from '@/base/assert'
import type { ExecutedWsMessage } from '@/platform/remote/comfyui/execution/types'
import { UserFile } from '@/stores/userFileStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { MissingModelCandidate } from '@/platform/workflowErrors/missingModel/types'
import type { MissingMediaCandidate } from '@/platform/workflowErrors/missingMedia/types'
import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import type { NodeLocatorId } from '@/types/nodeIdentification'
import type { SerializedNodeId } from '@/types/nodeId'
import type { AppMode } from '@/utils/appMode'
import type { WidgetId } from '@/types/widgetId'
import { generateUUID } from '@/utils/formatUtil'

export interface InputWidgetConfig {
  height?: number
  description?: string
}

type LinearInputId = WidgetId | NodeLocatorId | SerializedNodeId
type LinearOutputNodeId = SerializedNodeId
export type LinearInput = [LinearInputId, string, InputWidgetConfig?]

export interface LinearData {
  inputs: LinearInput[]
  outputs: LinearOutputNodeId[]
}

export interface PendingWarnings {
  missingNodeTypes?: MissingNodeType[]
  missingModelCandidates?: MissingModelCandidate[]
  missingMediaCandidates?: MissingMediaCandidate[]
}

/**
 * Undo/redo history of a loaded workflow. Implemented by
 * `ChangeTracker` in `@/scripts/changeTracker`; declared here so the
 * workflow model stays independent of the canvas runtime.
 */
export interface WorkflowChangeTracker {
  workflow: ComfyWorkflow
  initialState: ComfyWorkflowJSON
  activeState: ComfyWorkflowJSON
  undoQueue: ComfyWorkflowJSON[]
  redoQueue: ComfyWorkflowJSON[]
  changeCount: number
  _restoringState: boolean
  ds?: { scale: number; offset: [number, number] }
  nodeOutputs?: Partial<Record<string, ExecutedWsMessage['output']>>
  reset(state?: ComfyWorkflowJSON): void
  store(): void
  deactivate(): void
  prepareForSave(): void
  restore(): void
  updateModified(previousState?: ComfyWorkflowJSON): void
  captureCanvasState(): void
  checkState(): void
  updateState(
    source: ComfyWorkflowJSON[],
    target: ComfyWorkflowJSON[]
  ): Promise<void>
  undo(): Promise<void>
  redo(): Promise<void>
  undoRedo(e: KeyboardEvent, selectOnly?: boolean): Promise<true | undefined>
  beforeChange(): void
  afterChange(): void
}

interface WorkflowDraft {
  data: string
  updatedAt: number
}

/**
 * Runtime services a workflow needs while loading and saving. Registered by
 * the workflow store so this module does not depend on the change tracker,
 * draft persistence, or settings.
 */
export interface WorkflowRuntime {
  createChangeTracker(
    workflow: ComfyWorkflow,
    initialState: ComfyWorkflowJSON
  ): WorkflowChangeTracker
  getDraft(path: string): WorkflowDraft | null
  removeDraft(path: string): void
  markDraftUsed(path: string): void
  isDraftPersistenceEnabled(): boolean
  promptSave(workflow: ComfyWorkflow): Promise<string | null>
  forgetNodeHistories(rootGraphId: string): void
}

let registeredRuntime: WorkflowRuntime | null = null

export function registerWorkflowRuntime(runtime: WorkflowRuntime): void {
  registeredRuntime = runtime
}

function workflowRuntime(): WorkflowRuntime {
  assert(
    registeredRuntime,
    'Workflow runtime not registered; import the workflow store first'
  )
  return registeredRuntime
}

/**
 * Coarse shape of a workflow file's stored text. Never includes the content.
 * - `unavailable`: the text was never loaded (`null` / `undefined`)
 * - `empty`: only whitespace
 * - `null`: parses to JSON `null`
 * - `object`: parses to a plain JSON object (the healthy case)
 * - `other`: parses to an array, string, number or boolean
 * - `unparseable`: not valid JSON
 */
export type OriginalContentKind =
  | 'unavailable'
  | 'empty'
  | 'null'
  | 'object'
  | 'other'
  | 'unparseable'

export function classifyWorkflowContent(
  content: string | null | undefined
): OriginalContentKind {
  if (content == null) return 'unavailable'
  if (content.trim().length === 0) return 'empty'
  let parsed: unknown
  try {
    parsed = JSON.parse(content)
  } catch {
    return 'unparseable'
  }
  if (parsed === null) return 'null'
  if (typeof parsed === 'object' && !Array.isArray(parsed)) return 'object'
  return 'other'
}

/** The slice of a `ComfyWorkflow` that is safe to describe in telemetry. */
interface WorkflowStateProbe {
  path: string
  isLoaded: boolean
  isPersisted: boolean
  isTemporary: boolean
  changeTracker: unknown
  initialState: unknown
  activeState: unknown
  originalContent: string | null
}

const reportedAnomalies = new Set<string>()

/** @internal Test-only: forgets which anomalies were already reported. */
export function resetReportedWorkflowStateAnomaliesForTests(): void {
  reportedAnomalies.clear()
}

/**
 * Reports a workflow whose in-memory state was not what the caller assumed
 * (for example an active workflow with no change tracker). Each call site
 * recovers locally; this only makes the occurrence visible so the real trigger
 * can be found.
 *
 * `message` must be a static description: reporters forward it to telemetry
 * and group on it. Diagnostic values go in the context, which carries only
 * booleans and enum-like strings and never workflow names, paths or content.
 * Reports are deduplicated per call site and workflow.
 *
 * @param method Stable name of the call site, e.g. `ComfyWorkflow.save`.
 * @param workflow The workflow involved, when there is one.
 * @param extra Further booleans/enums, e.g. `{ isActive: true }`.
 */
export function reportWorkflowStateAnomaly(
  message: string,
  method: string,
  workflow?: WorkflowStateProbe,
  extra: Record<string, boolean | number | string | undefined> = {}
): void {
  const key = `${method}:${workflow?.path ?? ''}`
  if (reportedAnomalies.has(key)) return
  reportedAnomalies.add(key)

  assert(false, message, {
    method,
    ...(workflow && {
      isLoaded: workflow.isLoaded,
      hasChangeTracker: workflow.changeTracker != null,
      hasInitialState: workflow.initialState != null,
      hasActiveState: workflow.activeState != null,
      isPersisted: workflow.isPersisted,
      isTemporary: workflow.isTemporary,
      originalContentKind: classifyWorkflowContent(workflow.originalContent)
    }),
    ...extra
  })
}

/**
 * The saved draft to overlay on a freshly loaded workflow, if there is a usable
 * one. A stale or unparseable draft is removed.
 */
function readUsableDraft(
  runtime: WorkflowRuntime,
  workflow: ComfyWorkflow
): { state: ComfyWorkflowJSON; content: string } | null {
  const draft = runtime.getDraft(workflow.path)
  if (!draft) return null
  if (draft.updatedAt < workflow.lastModified) {
    runtime.removeDraft(workflow.path)
    return null
  }
  try {
    return { state: JSON.parse(draft.data), content: draft.data }
  } catch (err) {
    console.warn('Failed to parse workflow draft, clearing it', err)
    runtime.removeDraft(workflow.path)
    return null
  }
}

/**
 * The workflow object parsed from the stored text. Anything else (nothing
 * stored, empty text, JSON `null`, a number, an array) cannot back a change
 * tracker: a tracker around `null` is what later reads as a missing state.
 */
function parseStoredWorkflow(workflow: ComfyWorkflow): ComfyWorkflowJSON {
  const content = workflow.originalContent
  const parsed: unknown = content?.trim() ? JSON.parse(content) : undefined
  if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
    return parsed as ComfyWorkflowJSON
  }
  // `undefined` means there was nothing to parse; anything else parsed to
  // something that is not a workflow.
  if (parsed !== undefined) {
    reportWorkflowStateAnomaly(
      'Workflow content is not a JSON object',
      'ComfyWorkflow.load',
      workflow
    )
  }
  throw new Error(
    `Workflow content is ${parsed === undefined ? 'missing or empty' : 'not a JSON object'} for '${workflow.path}'`
  )
}

/** i18n keys for the dialog shown when a workflow is saved without a name. */
export interface SaveNamePrompt {
  title: string
  message: string
}

/**
 * The serialized state to persist. An unloaded workflow has no state, and
 * `JSON.stringify(null)` would overwrite the stored file with `null`.
 */
function requireActiveStateForSave(
  workflow: ComfyWorkflow,
  method: string
): ComfyWorkflowJSON {
  const state = workflow.activeState
  if (state) return state
  reportWorkflowStateAnomaly(
    'Workflow saved without an active state',
    method,
    workflow
  )
  throw new Error(`Cannot save workflow '${workflow.path}' before it is loaded`)
}

export class ComfyWorkflow extends UserFile {
  static readonly basePath: string = 'workflows/'
  readonly tintCanvasBg?: string
  /** Unique, stable identity for this workflow instance in the current session. */
  readonly instanceId = generateUUID()

  /**
   * The change tracker for the workflow. Non-reactive raw object.
   */
  changeTracker: WorkflowChangeTracker | null = null
  /**
   * Whether the workflow has been modified comparing to the initial state.
   */
  _isModified: boolean = false
  /**
   * Warnings deferred from load time, shown when the workflow is first focused.
   */
  pendingWarnings: PendingWarnings | null = null
  /**
   * Initial app mode derived from the serialized workflow (extra.linearMode).
   * - `undefined`: not yet resolved (first load hasn't happened)
   * - `null`: resolved, but no mode was set (never builder-saved)
   * - `AppMode`: resolved to a specific mode
   */
  initialMode: AppMode | null | undefined = undefined
  /**
   * Current app mode set by the user during the session.
   * Takes precedence over initialMode when present.
   */
  activeMode: AppMode | null = null
  shareId?: string
  legacyId?: string
  readonly saveNamePrompt: SaveNamePrompt = {
    title: 'workflowService.saveWorkflow',
    message: 'workflowService.enterFilenamePrompt'
  }
  /**
   * @param options The path, modified, and size of the workflow.
   * Note: path is the full path, including the 'workflows/' prefix.
   */
  constructor(options: { path: string; modified: number; size: number }) {
    super(options.path, options.modified, options.size)
  }

  override get key() {
    return this.path.substring(ComfyWorkflow.basePath.length)
  }

  get activeState(): ComfyWorkflowJSON | null {
    return this.changeTracker?.activeState ?? null
  }

  get initialState(): ComfyWorkflowJSON | null {
    return this.changeTracker?.initialState ?? null
  }

  override get isLoaded(): boolean {
    return this.changeTracker !== null
  }

  override get isModified(): boolean {
    return this._isModified
  }

  override set isModified(value: boolean) {
    this._isModified = value
  }

  /**
   * Load the workflow content from remote storage. Directly returns the loaded
   * workflow if the content is already loaded.
   *
   * @param force Whether to force loading the content even if it is already loaded.
   * @returns this
   */
  override async load({ force = false }: { force?: boolean } = {}): Promise<
    this & LoadedComfyWorkflow
  > {
    if (!force && this.isLoaded && this.changeTracker) {
      return this as this & LoadedComfyWorkflow
    }

    const runtime = workflowRuntime()
    const draft =
      !force && runtime.isDraftPersistenceEnabled()
        ? readUsableDraft(runtime, this)
        : null

    await super.load({ force })

    const initialState = parseStoredWorkflow(this)
    this.changeTracker = markRaw(
      runtime.createChangeTracker(this, initialState)
    )
    if (draft?.state && draft.content) {
      this.changeTracker.activeState = draft.state
      this.content = draft.content
      this._isModified = true
      // Saved-workflow draft overlay path; direct persisted-draft restores
      // are touched in workflowDraftStoreV2.loadDraft().
      runtime.markDraftUsed(this.path)
    }
    return this as this & LoadedComfyWorkflow
  }

  override unload(): void {
    const rootGraphId = this.changeTracker?.activeState.id
    if (rootGraphId) workflowRuntime().forgetNodeHistories(rootGraphId)
    this.changeTracker = null
    this.activeMode = null
    super.unload()
  }

  override async save() {
    this.content = JSON.stringify(
      requireActiveStateForSave(this, 'ComfyWorkflow.save')
    )
    // Force save to ensure the content is updated in remote storage incase
    // the isModified state is screwed by changeTracker.
    const ret = await super.save({ force: true })
    this.changeTracker?.reset()
    this.isModified = false
    workflowRuntime().removeDraft(this.path)
    return ret
  }

  /**
   * Save the workflow as a new file.
   * @param path The path to save the workflow to. Note: with 'workflows/' prefix.
   * @returns this
   */
  override async saveAs(path: string) {
    this.content = JSON.stringify(
      requireActiveStateForSave(this, 'ComfyWorkflow.saveAs')
    )
    const result = await super.saveAs(path)
    workflowRuntime().removeDraft(path)
    return result
  }

  async promptSave(): Promise<string | null> {
    return workflowRuntime().promptSave(this)
  }
}

export interface LoadedComfyWorkflow extends ComfyWorkflow {
  isLoaded: true
  originalContent: string
  content: string
  changeTracker: WorkflowChangeTracker
  initialState: ComfyWorkflowJSON
  activeState: ComfyWorkflowJSON
}
