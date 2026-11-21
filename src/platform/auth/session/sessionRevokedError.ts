type RevokedCode = 'SESSION_REVOKED' | 'TOKEN_REVOKED'

/** Ingest refused the sign-in because it predates a revocation. */
export class SessionRevokedError extends Error {
  readonly code: RevokedCode

  constructor(message: string, code: RevokedCode = 'SESSION_REVOKED') {
    super(message)
    this.name = 'SessionRevokedError'
    this.code = code
  }
}
