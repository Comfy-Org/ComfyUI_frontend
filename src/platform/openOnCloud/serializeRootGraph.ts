import { reportError } from '@/platform/telemetry/reportError'
import { app } from '@/scripts/app'

export function serializeRootGraph(): unknown {
  try {
    return app.rootGraph.serialize()
  } catch (error) {
    reportError(error, {
      errorType: 'failure_serializing_open_on_cloud_graph',
      surface: 'graph'
    })
    return null
  }
}
