import { useAppMode } from '@/composables/useAppMode'
import { useTelemetry } from '@/platform/telemetry'
import type {
  ExecutionTriggerSource,
  RunButtonProperties
} from '@/platform/telemetry/types'
import { getActionbarDockState } from '@/platform/telemetry/utils/getActionbarDockState'
import { getExecutionContext } from '@/platform/telemetry/utils/getExecutionContext'

type RunButtonTelemetryOptions = {
  subscribe_to_run?: boolean
  trigger_source?: ExecutionTriggerSource
}

export function getRunButtonTelemetryProperties(
  options?: RunButtonTelemetryOptions
): RunButtonProperties {
  const executionContext = getExecutionContext()
  const { mode, isAppMode } = useAppMode()

  return {
    subscribe_to_run: options?.subscribe_to_run ?? false,
    workflow_type: executionContext.is_template ? 'template' : 'custom',
    workflow_name: executionContext.workflow_name ?? 'untitled',
    custom_node_count: executionContext.custom_node_count,
    total_node_count: executionContext.total_node_count,
    subgraph_count: executionContext.subgraph_count,
    has_api_nodes: executionContext.has_api_nodes,
    api_node_names: executionContext.api_node_names,
    has_toolkit_nodes: executionContext.has_toolkit_nodes,
    toolkit_node_names: executionContext.toolkit_node_names,
    trigger_source: options?.trigger_source,
    view_mode: mode.value,
    is_app_mode: isAppMode.value,
    dock_state: getActionbarDockState()
  }
}

export function useRunButtonTelemetry() {
  function trackRunButton(options?: RunButtonTelemetryOptions): void {
    const telemetry = useTelemetry()
    if (!telemetry) return

    try {
      telemetry.trackRunButton(getRunButtonTelemetryProperties(options))
    } catch (error) {
      console.error('[Telemetry] Run button tracking failed', error)
    }
  }

  return { trackRunButton }
}
