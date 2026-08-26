import { describe, expect, it } from 'vitest'

import type { ExecutionContext } from '@/platform/telemetry/types'

import { toWorkflowExecutionContext } from './workflowExecutionContext'

const baseExecutionContext: ExecutionContext = {
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

const baseOptions = {
  executableNodeCount: 12,
  executionScope: 'partial' as const,
  viewMode: 'graph' as const
}

describe('toWorkflowExecutionContext', () => {
  it('returns bounded workflow dimensions without workflow content', () => {
    expect(
      toWorkflowExecutionContext(baseExecutionContext, baseOptions)
    ).toEqual({
      workflow_type: 'custom',
      view_mode: 'graph',
      execution_scope: 'partial',
      total_node_count: 42,
      executable_node_count: 12,
      custom_node_count: 3,
      api_node_count: 1,
      subgraph_count: 2
    })
  })

  it('identifies template workflows', () => {
    expect(
      toWorkflowExecutionContext(
        { ...baseExecutionContext, is_template: true },
        baseOptions
      ).workflow_type
    ).toBe('template')
  })
})
