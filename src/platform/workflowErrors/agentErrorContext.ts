export type AgentErrorContextScope = 'single' | 'card' | 'all'

export type AgentErrorCategory =
  | 'missing_model'
  | 'missing_media'
  | 'missing_node'
  | 'validation'
  | 'execution_failure'

export interface AgentErrorProblem {
  category: AgentErrorCategory
  /** Error catalog id the FE resolved (`catalogIds.ts`), e.g. `server_out_of_memory`. */
  catalogId?: string
  /** Job (`prompt_id`) whose run failed; absent for errors raised before a job ran. */
  jobId?: string
  message: string
  details?: string
  nodeId?: string
  nodeType?: string
  nodeTitle?: string
}

export type AgentErrorContextSeverity = 'error' | 'warning'
export interface AgentErrorContext {
  scope: AgentErrorContextScope
  count: number
  problems: AgentErrorProblem[]
  label: string
  severity: AgentErrorContextSeverity
  workflowName?: string
  /** Origin workflow path; null means no workflow, omission means unspecified. */
  workflowPath?: string | null
}
