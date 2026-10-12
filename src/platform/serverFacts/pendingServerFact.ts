export type BackendTicket = `BE-${number}`

/**
 * Interim bridge for a server fact the API does not emit yet. It expires with
 * the ticket: CI fails once the backend ticket closes, until the shipped field
 * is rendered and the wrapper deleted. See ADR-API-SERVER-FACTS-0042.
 */
export function pendingServerFact<T>(_ticket: BackendTicket, value: T): T {
  return value
}
