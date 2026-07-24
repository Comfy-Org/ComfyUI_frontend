import { describe, expect, it } from 'vitest'

import type { ExecutionContext } from '@/platform/telemetry/types'

import { toWorkflowExecutionContext } from './workflowExecutionContext'

describe('toWorkflowExecutionContext', () => {
  it('returns bounded workflow dimensions without workflow content', () => {
    const executionContext: ExecutionContext = {
      is_template: false,
      workflow_name: 'Private client workflow',
      custom_node_count: 3,
      api_node_count: 1,
      subgraph_count: 2,
      total_node_count: 42,
      has_api_nodes: true,
      api_node_names: ['PartnerNode'],
      has_toolkit_nodes: false,
      toolkit_node_names: [],
      toolkit_node_count: 0
    }

    expect(
      toWorkflowExecutionContext(executionContext, {
        executableNodeCount: 12,
        executionScope: 'partial',
        viewMode: 'graph'
      })
    ).toEqual({
      workflow_type: 'custom',
      view_mode: 'graph',
      execution_scope: 'partial',
      total_node_count: 42,
      executable_node_count: 12,
      custom_node_count: 3,
      api_node_count: 1,
      subgraph_count: 2,
      complexity_bucket: 'medium',
      dependency_profile: 'mixed'
    })
  })
})
