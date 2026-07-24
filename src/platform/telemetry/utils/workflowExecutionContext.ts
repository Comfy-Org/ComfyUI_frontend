import type {
  ExecutionContext,
  RunButtonProperties,
  WorkflowComplexityBucket,
  WorkflowDependencyProfile,
  WorkflowExecutionContext
} from '@/platform/telemetry/types'
import type { AppMode } from '@/utils/appMode'

interface WorkflowExecutionContextOptions {
  executableNodeCount: number
  executionScope: WorkflowExecutionContext['execution_scope']
  viewMode: AppMode
}

function getComplexityBucket(nodeCount: number): WorkflowComplexityBucket {
  if (nodeCount <= 20) return 'small'
  if (nodeCount <= 50) return 'medium'
  if (nodeCount <= 100) return 'large'
  return 'xlarge'
}

function getDependencyProfile(
  customNodeCount: number,
  apiNodeCount: number
): WorkflowDependencyProfile {
  if (apiNodeCount > 0 && customNodeCount > 0) return 'mixed'
  if (apiNodeCount > 0) return 'partner_nodes'
  if (customNodeCount > 0) return 'custom_nodes'
  return 'core_only'
}

export function toWorkflowRunActionContext({
  api_node_count,
  custom_node_count,
  execution_scope,
  subgraph_count,
  subscribe_to_run,
  total_node_count,
  trigger_source,
  view_mode,
  workflow_type
}: RunButtonProperties) {
  return {
    workflow_type,
    view_mode,
    execution_scope,
    total_node_count,
    custom_node_count,
    api_node_count,
    subgraph_count,
    complexity_bucket: getComplexityBucket(total_node_count),
    dependency_profile: getDependencyProfile(custom_node_count, api_node_count),
    ...(trigger_source && { trigger_source }),
    subscribe_to_run
  }
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
    subgraph_count: executionContext.subgraph_count,
    complexity_bucket: getComplexityBucket(executionContext.total_node_count),
    dependency_profile: getDependencyProfile(
      executionContext.custom_node_count,
      executionContext.api_node_count
    )
  }
}
