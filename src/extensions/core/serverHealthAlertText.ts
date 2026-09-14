/**
 * Some deployments send a badge that the message already carries, such as
 * "PREVIEW" beside "Preview Environment" or "WARN" beside "Warning Message".
 * Dropping it leaves the message to say it once.
 */
export function labelRepeatsMessage(
  label: string | undefined,
  message: string
): boolean {
  if (!label) return false
  const needle = label.toLowerCase()
  return message
    .toLowerCase()
    .split(/\s+/)
    .some((word) => word.startsWith(needle))
}
