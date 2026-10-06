import { zErrorResponse } from '@comfyorg/ingest-types/zod'

/**
 * ingest's 403 `code` for an account or workspace an SSO organization holds,
 * reached with a credential that is not an SSO sign-in. Every route answers
 * it, anonymous ones included.
 */
export const SSO_REQUIRED_SERVER_CODE = 'sso_required'

export function isSsoRequiredRefusal(status: number, body: unknown): boolean {
  return (
    status === 403 &&
    zErrorResponse.safeParse(body).data?.code === SSO_REQUIRED_SERVER_CODE
  )
}
