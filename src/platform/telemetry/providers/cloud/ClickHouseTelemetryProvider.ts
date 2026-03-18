import { api } from '@/scripts/api'

import type { TelemetryProvider, WorkflowImportMetadata } from '../../types'

/**
 * ClickHouse Telemetry Provider - Cloud Build Implementation
 *
 * Sends observability events to the cloud backend's ClickHouse pipeline
 * via POST /api/internal/cloud_analytics. Currently tracks missing node
 * data when users open/import workflows with unsupported nodes.
 *
 * This provider is separate from Mixpanel because ClickHouse is the
 * canonical store for post-hoc analytics (per observability philosophy).
 *
 * CRITICAL: OSS Build Safety
 * This file is tree-shaken away in OSS builds (DISTRIBUTION unset).
 */
export class ClickHouseTelemetryProvider implements TelemetryProvider {
  trackWorkflowImported(metadata: WorkflowImportMetadata): void {
    this.reportMissingNodes(metadata)
  }

  trackWorkflowOpened(metadata: WorkflowImportMetadata): void {
    this.reportMissingNodes(metadata)
  }

  private reportMissingNodes(metadata: WorkflowImportMetadata): void {
    if (metadata.missing_node_count <= 0) return

    api
      .fetchApi('/internal/cloud_analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: 'missing_nodes_detected',
          event_data: {
            missing_class_types: metadata.missing_node_types,
            missing_count: metadata.missing_node_count,
            source: metadata.open_source ?? 'unknown'
          }
        })
      })
      .catch(() => {})
  }
}
