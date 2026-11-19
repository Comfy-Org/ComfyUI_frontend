import { reportError } from '@comfyorg/telemetry/reportError'
import { useApp } from '@/scripts/appInstance'

export function serializeRootGraph(): unknown {
  try {
    return useApp().rootGraph.serialize()
  } catch (error) {
    reportError(error, {
      errorType: 'failure_serializing_open_on_cloud_graph',
      surface: 'graph'
    })
    return null
  }
}
