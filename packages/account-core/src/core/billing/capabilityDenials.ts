/**
 * Why a capability resolved false, decoded from the capabilities read.
 *
 * The server's contract runs one way only, and every reader here depends on
 * it: a reason is present only alongside `capabilities.<key> === false`, so
 * presence implies refusal — but absence implies nothing at all. A capability
 * with no reason may be granted, may be refused by a billing-api that predates
 * the field, or may be refused for a reason the server declined to forward.
 * `capabilities` stays the only authority for what a client may offer; these
 * keys only ever choose the wording for a refusal already decided there.
 */
import { z } from 'zod'

/**
 * The policy branches the server names, plus the bucket this module adds for
 * a value it does not recognize. `not_a_member` is unreachable through the
 * ingest endpoint — a non-member is answered 403 before capabilities resolve —
 * and is carried anyway because the billing-api endpoint can still emit it.
 */
export type CapabilityDenialReason =
  | 'not_a_member'
  | 'not_workspace_owner'
  | 'tier_not_self_serve'
  /** A subscription row reserved before payment that never began. */
  | 'subscription_not_started'
  /** The subscription already has a successor scheduled at a billing boundary. */
  | 'subscription_change_in_progress'
  /** The server has no guidance for the row — distinct from a deliberate refusal. */
  | 'subscription_status_unrecognized'
  | 'not_original_owner'
  | 'creator_only_provisioning'
  | 'payment_past_due'
  | 'free_plan'
  | 'no_subscription'
  | 'subscription_ended'
  | 'billing_operation_in_progress'
  | 'billing_operation_parked'
  | 'cancellation_scheduled'
  | 'cancellation_not_scheduled'
  | 'workspace_sso_attached'
  | 'personal_workspace'
  | 'plan_not_ended'
  | 'membership_managed_by_directory'
  | 'personal_workspace_creator'
  | 'workspace_creator'
  | 'only_owner'
  | 'billing_state_unknown'
  | 'free_tier_exhausted'
  | 'invite_capacity_reached'
  | 'manual_block'
  | 'no_funds'
  | 'no_revertible_scheduled_change'
  | 'no_upgrade_available'
  | 'partner_governance_not_entitled'
  | 'plan_ending'
  | 'project_cap_exceeded'
  | 'rollout_disabled'
  | 'sales_managed'
  | 'sales_managed_plan'
  | 'subscription_inactive'
  | 'usage_attribution_unavailable'
  | 'user_cap_exceeded'
  | 'workspace_cap_exceeded'
  /**
   * A reason outside the set above. Kept as a reason rather than dropped so a
   * refusal the server explained still reads as explained; the copy it maps to
   * is the generic one.
   */
  | 'unspecified'

const KNOWN_REASONS: Readonly<
  Record<Exclude<CapabilityDenialReason, 'unspecified'>, true>
> = {
  not_a_member: true,
  not_workspace_owner: true,
  tier_not_self_serve: true,
  subscription_not_started: true,
  subscription_change_in_progress: true,
  subscription_status_unrecognized: true,
  not_original_owner: true,
  creator_only_provisioning: true,
  payment_past_due: true,
  free_plan: true,
  no_subscription: true,
  subscription_ended: true,
  billing_operation_in_progress: true,
  billing_operation_parked: true,
  cancellation_scheduled: true,
  cancellation_not_scheduled: true,
  workspace_sso_attached: true,
  personal_workspace: true,
  plan_not_ended: true,
  membership_managed_by_directory: true,
  personal_workspace_creator: true,
  workspace_creator: true,
  only_owner: true,
  billing_state_unknown: true,
  free_tier_exhausted: true,
  invite_capacity_reached: true,
  manual_block: true,
  no_funds: true,
  no_revertible_scheduled_change: true,
  no_upgrade_available: true,
  partner_governance_not_entitled: true,
  plan_ending: true,
  project_cap_exceeded: true,
  rollout_disabled: true,
  sales_managed: true,
  sales_managed_plan: true,
  subscription_inactive: true,
  usage_attribution_unavailable: true,
  user_cap_exceeded: true,
  workspace_cap_exceeded: true
}

/**
 * The record is open because the server adds keys as policy grows, and a
 * client that rejected an unknown key would fail the whole read over a field
 * it does not use.
 */
export type CapabilityDenials = Readonly<
  Partial<Record<string, CapabilityDenialReason>>
>

/**
 * Deliberately lenient: values are read as plain strings and narrowed here,
 * never as a generated enum. A strict enum parse would make the entire
 * capabilities read malformed the first time the server names a policy branch
 * this client predates — turning a copy detail into a total loss of the
 * capability set, which is the one part of the response that gates UI.
 *
 * This mirrors what the ingest service already does on its own side, where an
 * unrecognized reason is dropped rather than forwarded.
 */
const DeniedReasonsSchema = z.record(z.string(), z.string()).optional()

export function decodeCapabilityDenials(raw: unknown): CapabilityDenials {
  const parsed = DeniedReasonsSchema.safeParse(raw)
  if (!parsed.success || parsed.data === undefined) return {}

  const denials: Record<string, CapabilityDenialReason> = {}
  for (const [capability, reason] of Object.entries(parsed.data)) {
    denials[capability] = Object.hasOwn(KNOWN_REASONS, reason)
      ? (reason as CapabilityDenialReason)
      : 'unspecified'
  }
  return denials
}
