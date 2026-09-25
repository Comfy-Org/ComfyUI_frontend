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
  /**
   * A reason outside the set above. Kept as a reason rather than dropped so a
   * refusal the server explained still reads as explained; the copy it maps to
   * is the generic one.
   */
  | 'unspecified'

const KNOWN_REASONS: ReadonlySet<string> = new Set<CapabilityDenialReason>([
  'not_a_member',
  'not_workspace_owner',
  'tier_not_self_serve',
  'subscription_not_started',
  'subscription_change_in_progress',
  'subscription_status_unrecognized'
])

/**
 * Only `can_subscribe_self_serve` carries a reason today. The record is open
 * because the server adds keys as policy grows, and a client that rejected an
 * unknown key would fail the whole read over a field it does not use.
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
    denials[capability] = KNOWN_REASONS.has(reason)
      ? (reason as CapabilityDenialReason)
      : 'unspecified'
  }
  return denials
}
