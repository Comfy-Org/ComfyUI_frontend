import type {
  ExecutionContext,
  WorkflowExecutionContext
} from '@/platform/telemetry/types'
import type { AppMode } from '@/utils/appMode'

interface WorkflowExecutionContextOptions {
  executableNodeCount: number
  executionScope: WorkflowExecutionContext['execution_scope']
  viewMode: AppMode
}

export function toWorkflowExecutionContext(
  executionContext: ExecutionContext,
  {
    executableNodeCount,
    executionScope,
    viewMode
  }: WorkflowExecutionContextOptions
): WorkflowExecutionContext {
  return {
    workflow_type: executionContext.is_template ? 'template' : 'custom',
    view_mode: viewMode,
    execution_scope: executionScope,
    total_node_count: executionContext.total_node_count,
    executable_node_count: executableNodeCount,
    custom_node_count: executionContext.custom_node_count,
    api_node_count: executionContext.api_node_count,
    subgraph_count: executionContext.subgraph_count
  }
}
