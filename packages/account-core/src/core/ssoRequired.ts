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

/**
 * ingest's 403 `code` for an account off the verified domains of the SSO
 * organization that holds the workspace: no sign-in admits it there.
 */
const ACCOUNT_OUTSIDE_ORGANIZATION_SERVER_CODE = 'account_outside_organization'

export function isAccountOutsideOrganizationRefusal(
  status: number,
  body: unknown
): boolean {
  return (
    status === 403 &&
    zErrorResponse.safeParse(body).data?.code ===
      ACCOUNT_OUTSIDE_ORGANIZATION_SERVER_CODE
  )
}
