export const AGENT_CONSENT_SETTING_ID =
  'Comfy.AgentPanel.ConsentAccepted' as const

/**
 * Records that the user pressed the consent card's explicit Reject action, so
 * the agent stops promoting itself automatically. Deliberately **not** in the
 * `/api/global-settings` consent registry {@link AGENT_CONSENT_SETTING_ID}
 * lives in: that registry is the audited record of consent, is closed, and
 * accepts only the literal `true` with DELETE as its only revocation - so a
 * refusal cannot be expressed there without a tri-state value or a second
 * registered key, both of which are server changes.
 *
 * A refusal is not a consent record, it is a promotion preference, and this is
 * the domain that already carries those. On cloud `/api/settings` is stored on
 * the user row, so suppression survives a reload and follows the account to
 * another browser profile or device, which is what PM-1910 asked for.
 */
export const AGENT_CONSENT_OFFER_DECLINED_SETTING_ID =
  'Comfy.AgentPanel.ConsentOfferDeclined' as const
