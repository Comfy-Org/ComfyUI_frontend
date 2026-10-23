import type { FactValue, ServerFact } from './serverFact'

export type BackendTicket = `BE-${number}`

/**
 * Interim bridge for a server fact the API does not emit yet. It expires with
 * the ticket: CI fails once the backend ticket closes, until the shipped field
 * is rendered and the wrapper deleted. See ADR-API-SERVER-FACTS-0042.
 *
 * `Field` is inferred from the gate it fills; without one it widens to
 * `string`, which no gate accepts.
 */
export function pendingServerFact<Field extends string, T>(
  _ticket: BackendTicket,
  value: T
): ServerFact<Field, FactValue<T>> {
  return value as ServerFact<Field, FactValue<T>>
}
