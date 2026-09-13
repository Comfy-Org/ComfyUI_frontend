import type { ComposerInsertionPoint } from './composerPrompt'
import type { WorkflowReferenceMetadata } from './workflowReference'

export interface PromptEditor {
  insertionPoint?: () => ComposerInsertionPoint
  focus: () => void
  selection: () => { start: number; end: number }
  replaceText: (from: number, to: number, text: string) => void
  captureInsertion: (
    from?: number,
    to?: number
  ) => {
    insert: (reference: WorkflowReferenceMetadata) => void
    cancel: () => void
  }
}
