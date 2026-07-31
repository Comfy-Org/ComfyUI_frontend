import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ExecutionContext, ShellLayoutMetadata } from '../../types'
import { SentryTelemetryProvider } from './SentryTelemetryProvider'

const mocks = vi.hoisted(() => ({
  addBreadcrumb: vi.fn(),
  setContext: vi.fn(),
  setUser: vi.fn(),
  onUserLogout: vi.fn(),
  resolvedUserId: 'existing-user' as string | undefined,
  workflowIsModified: true,
  executionContext: {
    is_template: false,
    workflow_name: 'private-workflow-name',
    custom_node_count: 2,
    api_node_count: 1,
    toolkit_node_count: 1,
    subgraph_count: 3,
    total_node_count: 12,
    has_api_nodes: true,
    api_node_names: ['PrivateApiNode'],
    has_toolkit_nodes: true,
    toolkit_node_names: ['PrivateToolkitNode']
  } satisfies ExecutionContext
}))

vi.mock('@sentry/vue', () => ({
  addBreadcrumb: mocks.addBreadcrumb,
  setContext: mocks.setContext,
  setUser: mocks.setUser
}))

vi.mock('@/composables/auth/useCurrentUser', () => ({
  useCurrentUser: () => ({
    onUserLogout: mocks.onUserLogout,
    resolvedUserInfo: {
      value: mocks.resolvedUserId
        ? {
            id: mocks.resolvedUserId
          }
        : null
    }
  })
}))

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({
    activeWorkflow: {
      isModified: mocks.workflowIsModified
    }
  })
}))

vi.mock('../../utils/getExecutionContext', () => ({
  getExecutionContext: () => mocks.executionContext
}))

const shellLayout: ShellLayoutMetadata = {
  view_mode: 'graph',
  is_app_mode: false,
  dock_state: 'docked',
  actionbar_position: 'top',
  active_sidebar_tab: 'node-library',
  right_side_panel_open: false,
  bottom_panel_open: true,
  open_workflow_tabs: 2
}

describe('SentryTelemetryProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.resolvedUserId = 'existing-user'
    mocks.workflowIsModified = true
  })

  it('identifies resolved and newly authenticated users and clears logout', () => {
    const provider = new SentryTelemetryProvider()

    provider.trackUserLoggedIn()
    provider.trackAuth({ user_id: 'new-user' })

    expect(mocks.setUser).toHaveBeenNthCalledWith(1, { id: 'existing-user' })
    expect(mocks.setUser).toHaveBeenNthCalledWith(2, { id: 'new-user' })
    expect(mocks.onUserLogout).toHaveBeenCalledOnce()

    const onLogout = mocks.onUserLogout.mock.calls[0][0]
    onLogout()

    expect(mocks.setUser).toHaveBeenLastCalledWith(null)
  })

  it('sets bounded app context without workflow names or node-name arrays', () => {
    const provider = new SentryTelemetryProvider()

    provider.trackShellLayout(shellLayout)

    expect(mocks.setContext).toHaveBeenCalledExactlyOnceWith(
      'ComfyUI App State',
      {
        ...shellLayout,
        workflow_is_modified: true,
        is_template: false,
        custom_node_count: 2,
        api_node_count: 1,
        toolkit_node_count: 1,
        subgraph_count: 3,
        total_node_count: 12,
        has_api_nodes: true,
        has_toolkit_nodes: true
      }
    )
  })

  it('records privacy-safe node and execution breadcrumbs', () => {
    const provider = new SentryTelemetryProvider()

    provider.trackNodeAdded({
      node_type: 'KSampler',
      source: 'search_modal'
    })
    provider.trackWorkflowExecution()
    provider.trackExecutionError({
      jobId: 'private-job-id',
      nodeId: 'private-node-id',
      nodeType: 'KSampler',
      error: 'private exception details'
    })
    provider.trackExecutionSuccess({ jobId: 'private-job-id' })

    expect(mocks.addBreadcrumb).toHaveBeenNthCalledWith(1, {
      category: 'workflow',
      message: 'node_added',
      level: 'info',
      data: {
        node_type: 'KSampler',
        source: 'search_modal'
      }
    })
    expect(mocks.addBreadcrumb).toHaveBeenNthCalledWith(2, {
      category: 'workflow.execution',
      message: 'started',
      level: 'info'
    })
    expect(mocks.addBreadcrumb).toHaveBeenNthCalledWith(3, {
      category: 'workflow.execution',
      message: 'failed',
      level: 'error',
      data: { node_type: 'KSampler' }
    })
    expect(mocks.addBreadcrumb).toHaveBeenNthCalledWith(4, {
      category: 'workflow.execution',
      message: 'succeeded',
      level: 'info'
    })
    expect(mocks.setContext).toHaveBeenCalledWith('Workflow Execution', {
      status: 'failure',
      node_type: 'KSampler'
    })
  })
})
