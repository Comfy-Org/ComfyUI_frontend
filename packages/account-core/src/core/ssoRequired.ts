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

/**
 * The organization whose SSO the refusal asks for, when ingest names one. A
 * workspace accepts only its own organization's sign-in, so this outranks the
 * organization the email's domain would discover.
 */
export function ssoRequiredOrganizationId(body: unknown): string | undefined {
  return zErrorResponse.safeParse(body).data?.organization_id || undefined
}
