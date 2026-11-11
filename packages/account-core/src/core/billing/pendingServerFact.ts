export type BackendTicket = `BE-${number}`

/** Interim client value for a server fact a backend ticket has not shipped yet; delete the call once the field is served. */
export function pendingServerFact<T>(_ticket: BackendTicket, value: T): T {
  return value
}
