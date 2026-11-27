import { truncate } from 'es-toolkit/compat'

import type { AgentWorkflowSyncErrorCode } from '@comfyorg/telemetry/types'

/** Cap on the doc-host's raw refusal message appended to the localized detail
 * below — the host's `message` is developer text of unbounded length, not
 * meant to replace the reassurance the localized copy gives the person. */
const SYNC_ERROR_RAW_MESSAGE_MAX_LENGTH = 200

/** Returns localized sync guidance with safe raw context when applicable. */
export function formatWorkflowSyncErrorDetail(
  translate: (key: string) => string,
  message: string | undefined,
  code?: string
): string {
  const detail = translate(detailKey(code))
  if (!message || code === 'catalog_mismatch') return detail
  return `${detail} (${truncate(message, { length: SYNC_ERROR_RAW_MESSAGE_MAX_LENGTH })})`
}

function detailKey(code: string | undefined): string {
  switch (code) {
    case 'catalog_mismatch':
      return 'agent.workflowSyncFailedDetailCatalogMismatch'
    case 'stale_client_schema':
      return 'agent.workflowSyncFailedDetailStaleClient'
    case 'stale_host_schema':
      return 'agent.workflowSyncFailedDetailStaleHost'
    default:
      return 'agent.workflowSyncFailedDetail'
  }
}

const KNOWN_SYNC_ERROR_CODES: ReadonlySet<string> = new Set<
  Exclude<AgentWorkflowSyncErrorCode, 'other'>
>([
  'schema_version_mismatch',
  'catalog_mismatch',
  'unsupported',
  'stale_client_schema',
  'stale_host_schema'
])

function isKnownSyncErrorCode(
  code: string | undefined
): code is Exclude<AgentWorkflowSyncErrorCode, 'other'> {
  return code !== undefined && KNOWN_SYNC_ERROR_CODES.has(code)
}

/** Maps a doc-host sync error code to its telemetry tag; unknown codes map to `other`. */
export function workflowSyncErrorTelemetryCode(
  code: string | undefined
): AgentWorkflowSyncErrorCode {
  return isKnownSyncErrorCode(code) ? code : 'other'
}
