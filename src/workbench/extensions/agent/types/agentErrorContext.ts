export type AgentErrorContextScope = 'single' | 'card' | 'all'

export type AgentErrorCategory =
  | 'missing_input'
  | 'missing_model'
  | 'missing_media'
  | 'missing_node'
  | 'validation'
  | 'execution_failure'

export interface AgentErrorProblem {
  category: AgentErrorCategory
  /** Exact error or validation message as surfaced to the user. */
  message: string
  /** Logs, traceback, or other detail where available. */
  details?: string
  /** Canvas (litegraph) node id, when the problem is tied to a located node. */
  nodeId?: string
  /** Node class type / `class_type`, when available. */
  nodeType?: string
  /** Human-facing node title, when available. */
  nodeTitle?: string
}

export type AgentErrorContextSeverity = 'error' | 'warning'

/** The shared handoff every "Ask agent" affordance attaches to the composer. */
export interface AgentErrorContext {
  scope: AgentErrorContextScope
  /** Number of problems included, as shown to the user before sending. */
  count: number
  problems: AgentErrorProblem[]
  /** Short category-style label for the chip, e.g. "Missing media". */
  label: string
  /** Drives the chip's error vs warning styling. */
  severity: AgentErrorContextSeverity
  /** Originating workflow name, when known. */
  workflowName?: string
  /** Search/filter text in effect when the `all` scope was captured. */
  searchQuery?: string
}
