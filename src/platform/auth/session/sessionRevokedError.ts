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

export function revokedCodeOf(code: string | undefined): RevokedCode | null {
  return code === 'SESSION_REVOKED' || code === 'TOKEN_REVOKED' ? code : null
}
