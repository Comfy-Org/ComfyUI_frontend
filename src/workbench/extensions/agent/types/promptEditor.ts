import type { ComposerInsertionPoint } from './composerPrompt'
import type { SkillReferenceMetadata } from './skillReference'
import type { WorkflowReferenceMetadata } from './workflowReference'

export interface PromptEditor {
  insertionPoint?: () => ComposerInsertionPoint
  focus: () => void
  selection: () => { start: number; end: number }
  insertText: (text: string) => void
  replaceText: (from: number, to: number, text: string) => void
  selectSkill: (
    reference: SkillReferenceMetadata,
    from: number,
    to: number
  ) => void
  captureInsertion: (
    from?: number,
    to?: number
  ) => {
    insert: (reference: WorkflowReferenceMetadata) => void
    cancel: () => void
  }
}
