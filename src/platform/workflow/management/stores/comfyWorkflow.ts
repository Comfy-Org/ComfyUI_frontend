import { markRaw } from 'vue'

import { assert } from '@/base/assert'
import type { ExecutedWsMessage } from '@/platform/remote/comfyui/execution/types'
import { UserFile } from '@/stores/userFileStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'
import type { MissingModelCandidate } from '@/platform/missingModel/types'
import type { MissingMediaCandidate } from '@/platform/missingMedia/types'
import type { MissingNodeType } from '@/platform/nodeReplacement/types'
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

/** i18n keys for the dialog shown when a workflow is saved without a name. */
export interface SaveNamePrompt {
  title: string
  message: string
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
    let draft =
      !force && runtime.isDraftPersistenceEnabled()
        ? runtime.getDraft(this.path)
        : null
    let draftState: ComfyWorkflowJSON | null = null
    let draftContent: string | null = null

    if (draft) {
      if (draft.updatedAt < this.lastModified) {
        runtime.removeDraft(this.path)
        draft = null
      }
    }

    if (draft) {
      try {
        draftState = JSON.parse(draft.data)
        draftContent = draft.data
      } catch (err) {
        console.warn('Failed to parse workflow draft, clearing it', err)
        runtime.removeDraft(this.path)
      }
    }

    await super.load({ force })

    if (this.originalContent == null) {
      throw new Error(
        `[ASSERT] Workflow content should be loaded for '${this.path}'`
      )
    }
    if (this.originalContent.trim().length === 0) {
      throw new Error(`Workflow content is empty for '${this.path}'`)
    }

    const initialState = JSON.parse(this.originalContent)
    this.changeTracker = markRaw(
      runtime.createChangeTracker(this, initialState)
    )
    if (draftState && draftContent) {
      this.changeTracker.activeState = draftState
      this.content = draftContent
      this._isModified = true
      // Saved-workflow draft overlay path; direct persisted-draft restores
      // are touched in workflowDraftStoreV2.loadDraft().
      runtime.markDraftUsed(this.path)
    }
    return this as this & LoadedComfyWorkflow
  }

  override unload(): void {
    this.changeTracker = null
    this.activeMode = null
    super.unload()
  }

  override async save() {
    this.content = JSON.stringify(this.activeState)
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
    this.content = JSON.stringify(this.activeState)
    const result = await super.saveAs(path)
    workflowRuntime().removeDraft(path)
    return result
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
