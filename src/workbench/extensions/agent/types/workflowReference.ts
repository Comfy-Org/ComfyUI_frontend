export interface WorkflowReference {
  id: string
  name: string
  unavailable?: boolean
}

export type WorkflowReferenceOption =
  | { id: string; name: string }
  | { id?: undefined; name: string; tabPath: string }
