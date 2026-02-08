import { markRaw } from 'vue'

import { t } from '@/i18n'
import type { ChangeTracker } from '@/scripts/changeTracker'
import { UserFile } from '@/stores/userFileStore'
import type { ComfyWorkflowJSON } from '@/platform/workflow/validation/schemas/workflowSchema'

export class ComfyWorkflow extends UserFile {
  static readonly basePath: string = 'workflows/'
  readonly tintCanvasBg?: string

  /**
   * The change tracker for the workflow. Non-reactive raw object.
   */
  changeTracker: ChangeTracker | null = null
  /**
   * Whether the workflow has been modified comparing to the initial state.
   */
  _isModified: boolean = false

  /**
   * @param options The path, modified, and size of the workflow.
   * Note: path is the full path, including the 'workflows/' prefix.
   */
  constructor(options: { path: string; modified: number; size: number }) {
    super(options.path, options.modified, options.size)
  }

  override get key() {
    return this.path.slice(ComfyWorkflow.basePath.length)
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
    const { useWorkflowDraftStore } =
      await import('@/platform/workflow/persistence/stores/workflowDraftStore')
    const draftStore = useWorkflowDraftStore()
    let draft = !force ? draftStore.getDraft(this.path) : undefined
    let draftState: ComfyWorkflowJSON | null = null
    let draftContent: string | null = null

    if (draft && draft.updatedAt < this.lastModified) {
      draftStore.removeDraft(this.path)
      draft = undefined
    }

    if (draft) {
      try {
        draftState = JSON.parse(draft.data)
        draftContent = draft.data
      } catch (error) {
        console.warn('Failed to parse workflow draft, clearing it', error)
        draftStore.removeDraft(this.path)
      }
    }

    await super.load({ force })
    if (!force && this.isLoaded) return this as this & LoadedComfyWorkflow

    if (!this.originalContent) {
      throw new Error('[ASSERT] Workflow content should be loaded')
    }

    const initialState = JSON.parse(this.originalContent)
    const { ChangeTracker } = await import('@/scripts/changeTracker')
    this.changeTracker = markRaw(new ChangeTracker(this, initialState))
    if (draftState && draftContent) {
      this.changeTracker.activeState = draftState
      this.content = draftContent
      this._isModified = true
      draftStore.markDraftUsed(this.path)
    }
    return this as this & LoadedComfyWorkflow
  }

  override unload(): void {
    this.changeTracker = null
    super.unload()
  }

  override async save() {
    const { useWorkflowDraftStore } =
      await import('@/platform/workflow/persistence/stores/workflowDraftStore')
    const draftStore = useWorkflowDraftStore()
    this.content = JSON.stringify(this.activeState)
    // Force save to ensure the content is updated in remote storage incase
    // the isModified state is screwed by changeTracker.
    const ret = await super.save({ force: true })
    this.changeTracker?.reset()
    this.isModified = false
    draftStore.removeDraft(this.path)
    return ret
  }

  /**
   * Save the workflow as a new file.
   * @param path The path to save the workflow to. Note: with 'workflows/' prefix.
   * @returns this
   */
  override async saveAs(path: string) {
    const { useWorkflowDraftStore } =
      await import('@/platform/workflow/persistence/stores/workflowDraftStore')
    const draftStore = useWorkflowDraftStore()
    this.content = JSON.stringify(this.activeState)
    const result = await super.saveAs(path)
    draftStore.removeDraft(path)
    return result
  }

  async promptSave(): Promise<string | null> {
    const { useDialogService } = await import('@/services/dialogService')
    return await useDialogService().prompt({
      title: t('workflowService.saveWorkflow'),
      message: t('workflowService.enterFilenamePrompt'),
      defaultValue: this.filename
    })
  }
}

export interface LoadedComfyWorkflow extends ComfyWorkflow {
  isLoaded: true
  originalContent: string
  content: string
  changeTracker: ChangeTracker
  initialState: ComfyWorkflowJSON
  activeState: ComfyWorkflowJSON
}
