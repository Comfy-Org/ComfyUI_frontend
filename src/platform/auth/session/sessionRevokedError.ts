import { classifyWebSessionFailure } from '@comfyorg/account-core/webSession'

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

/** The revoked session in a refused ingest response, or undefined for every other refusal. */
export function sessionRevokedRefusal(
  message: string,
  status: number,
  body: unknown
): SessionRevokedError | undefined {
  const failure = classifyWebSessionFailure(status, body)
  if (failure.code !== 'SESSION_REVOKED') return undefined
  return new SessionRevokedError(
    message,
    failure.serverCode === 'TOKEN_REVOKED' ? 'TOKEN_REVOKED' : 'SESSION_REVOKED'
  )
}
