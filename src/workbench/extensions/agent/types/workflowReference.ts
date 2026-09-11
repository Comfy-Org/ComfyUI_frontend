export interface WorkflowReference {
  id: string
  name: string
  unavailable?: boolean
  /** UTF-16 offset in the prompt text, excluding reference tokens. */
  textOffset?: number
}

export type WorkflowReferenceOption =
  | { id: string; name: string }
  | { id?: undefined; name: string; tabPath: string }
