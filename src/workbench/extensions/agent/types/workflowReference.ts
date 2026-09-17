export interface WorkflowReferenceMetadata {
  id: string
  name: string
  unavailable?: boolean
}

export interface WorkflowReference extends WorkflowReferenceMetadata {
  /** UTF-16 offset in the prompt text, excluding reference tokens. */
  textOffset: number
}

export interface PromptSnapshot {
  text: string
  workflowReferences: WorkflowReference[]
}

export type WorkflowReferenceOption =
  | { id: string; name: string }
  | { id?: undefined; name: string; tabPath: string }
