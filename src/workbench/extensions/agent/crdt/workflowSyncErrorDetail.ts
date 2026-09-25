import { truncate } from 'es-toolkit/compat'

/** Cap on the doc-host's raw refusal message appended to the localized detail
 * below — the host's `message` is developer text of unbounded length, not
 * meant to replace the reassurance the localized copy gives the person. */
const SYNC_ERROR_RAW_MESSAGE_MAX_LENGTH = 200

/**
 * PM-1604 / BE-11437: the permanent-desync toast's `detail` always leads with
 * the localized copy (so the person keeps the "canvas unchanged" reassurance
 * even when the doc-host's raw `message` is untranslated developer text or
 * absent), appending that raw message, clamped, as extra context only when
 * present.
 */
export function formatWorkflowSyncErrorDetail(
  translate: (key: string) => string,
  message: string | undefined
): string {
  const detail = translate('agent.workflowSyncFailedDetail')
  if (!message) return detail
  return `${detail} (${truncate(message, { length: SYNC_ERROR_RAW_MESSAGE_MAX_LENGTH })})`
}
