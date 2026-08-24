import * as Sentry from '@sentry/vue'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

import type {
  AuthMetadata,
  ExecutionErrorMetadata,
  ExecutionSuccessMetadata,
  NodeAddedMetadata,
  ShellLayoutMetadata,
  TelemetryProvider
} from '../../types'
import { getExecutionContext } from '../../utils/getExecutionContext'

export class SentryTelemetryProvider implements TelemetryProvider {
  private shellLayout: ShellLayoutMetadata | null = null
  private isWatchingLogout = false

  trackAuth({ user_id }: AuthMetadata): void {
    this.setUser(user_id)
  }

  trackUserLoggedIn(): void {
    this.setUser(useCurrentUser().resolvedUserInfo.value?.id)
  }

  trackShellLayout(metadata: ShellLayoutMetadata): void {
    this.shellLayout = metadata
    this.updateAppContext()
  }

  trackNodeAdded({ node_type, source }: NodeAddedMetadata): void {
    Sentry.addBreadcrumb({
      category: 'workflow',
      message: 'node_added',
      level: 'info',
      data: { node_type, source }
    })
  }

  trackWorkflowExecution(): void {
    Sentry.addBreadcrumb({
      category: 'workflow.execution',
      message: 'started',
      level: 'info'
    })
    Sentry.setContext('Workflow Execution', { status: 'running' })
    this.updateAppContext()
  }

  trackExecutionError({ nodeType }: ExecutionErrorMetadata): void {
    const data = nodeType ? { node_type: nodeType } : undefined
    Sentry.addBreadcrumb({
      category: 'workflow.execution',
      message: 'failed',
      level: 'error',
      data
    })
    Sentry.setContext('Workflow Execution', {
      status: 'failure',
      ...data
    })
    this.updateAppContext()
  }

  trackExecutionSuccess(_metadata: ExecutionSuccessMetadata): void {
    Sentry.addBreadcrumb({
      category: 'workflow.execution',
      message: 'succeeded',
      level: 'info'
    })
    Sentry.setContext('Workflow Execution', { status: 'success' })
    this.updateAppContext()
  }

  private setUser(userId: string | undefined): void {
    if (!userId) return

    Sentry.setUser({ id: userId })
    this.watchForLogout()
  }

  private watchForLogout(): void {
    if (this.isWatchingLogout) return

    this.isWatchingLogout = true
    useCurrentUser().onUserLogout(() => {
      Sentry.setUser(null)
    })
  }

  private updateAppContext(): void {
    const {
      is_template,
      custom_node_count,
      api_node_count,
      toolkit_node_count,
      subgraph_count,
      total_node_count,
      has_api_nodes,
      has_toolkit_nodes
    } = getExecutionContext()
    const activeWorkflow = useWorkflowStore().activeWorkflow

    Sentry.setContext('ComfyUI App State', {
      ...(this.shellLayout ?? {}),
      workflow_is_modified: activeWorkflow?.isModified ?? false,
      is_template,
      custom_node_count,
      api_node_count,
      toolkit_node_count,
      subgraph_count,
      total_node_count,
      has_api_nodes,
      has_toolkit_nodes
    })
  }
}
