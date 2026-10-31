let clientSessionId: string | undefined

/**
 * An opaque id for this page load. It exists before any agent thread does, so a
 * feedback report with no thread can still be joined to the send telemetry.
 */
export function agentClientSessionId(): string {
  clientSessionId ??= crypto.randomUUID()
  return clientSessionId
}
