/**
 * Session-scoped record of which workflows were imported from a share link.
 * Keyed by workflow path so telemetry (e.g. execution_start) can attribute
 * runs of a shared workflow to the share_id that delivered it. Intentionally
 * in-memory only: attribution does not survive a reload or a save/rename.
 */
const shareIdByWorkflowKey = new Map<string, string>()

export function recordShareProvenance(
  workflowKey: string,
  shareId: string
): void {
  shareIdByWorkflowKey.set(workflowKey, shareId)
}

export function getShareProvenance(workflowKey: string): string | undefined {
  return shareIdByWorkflowKey.get(workflowKey)
}
