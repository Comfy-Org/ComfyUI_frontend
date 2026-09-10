import type { BillingStatusResponse } from '@/platform/workspace/api/workspaceApi'

/**
 * EDU markers on the billing status response (`GET /customers/cloud-subscription-status`,
 * shared by the legacy and workspace billing rails).
 *
 * `is_edu` ships in Comfy-Org/cloud#8725 + #8723 (still in review); this
 * augmentation is dropped once registry-types regenerates from the merged
 * schema.
 *
 * `team_has_edu_member` ("at least one current workspace member has
 * is_edu = true") has no backing field yet — the backend PR that adds it is a
 * separate, not-yet-started piece of work tracked alongside #8725/#8723. It is
 * declared here so the team EDU pricing ladder can be built and tested now:
 * every real response omits the field, so it reads `undefined` and the team
 * discount stays inactive until that PR ships the real value.
 */
export type BillingStatusResponseWithEdu = BillingStatusResponse & {
  is_edu?: boolean
  team_has_edu_member?: boolean
}
