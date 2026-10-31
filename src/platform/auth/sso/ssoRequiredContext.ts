export interface SsoRequiredContext {
  readonly email?: string
  /** Where SSO sends the person back; the current page when absent. */
  readonly returnTo?: string
  /** The organization the refusal names; its SSO, not the email's. */
  readonly organizationId?: string
}
