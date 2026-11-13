export type AgentErrorContextScope = 'single' | 'card' | 'all'

export type AgentErrorCategory =
  | 'missing_model'
  | 'missing_media'
  | 'missing_node'
  | 'validation'
  | 'execution_failure'

export interface AgentErrorProblem {
  category: AgentErrorCategory
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
  workflowPath?: string
}
