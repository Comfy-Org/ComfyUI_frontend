import { AGENT_CONSENT_OFFER_DECLINED_SETTING_ID } from '@/platform/settings/constants/agent'
import { useSettingStore } from '@/platform/settings/settingStore'
import { api } from '@/scripts/api'

class ConsentOfferDeclinedWriteError extends Error {}

/**
 * Whether the user has pressed the consent card's explicit Reject action, which
 * suppresses every automatic consent offer from then on. Read before the
 * automatic offer; the explicit paths (`first_message`, `button_click`) ignore
 * it on purpose, because reopening consent is exactly what the user asked for
 * by sending.
 *
 * Awaits the settings load rather than reading whatever is in memory: the
 * automatic offer's own chain can settle on a cached consent read, and
 * answering "not declined" from an unloaded store is the one wrong answer here
 * - it shows a card to the user who already refused it, which is PM-1910.
 *
 * A store that cannot be read answers false, so the offer proceeds. This is not
 * fail-open by preference: the loader is boot-critical (GraphCanvas rethrows its
 * error before any core setting registers), so a session that reaches the agent
 * at all has already loaded settings successfully, and the remaining failure
 * shapes are a store that never loaded - where no refusal can be stored either.
 */
export async function consentOfferDeclined(): Promise<boolean> {
  const settingStore = useSettingStore()
  try {
    await settingStore.load()
  } catch {
    return false
  }
  if (settingStore.error !== undefined) return false
  return  settingStore.get(AGENT_CONSENT_OFFER_DECLINED_SETTING_ID)
}

/**
 * Records the refusal so it outlives this page load, this panel session and
 * this device. Written only from the explicit Reject action - a close, an
 * Escape or a backdrop click is a `dismissed` card, not a refusal, and must
 * keep its current behaviour.
 *
 * Only ever written `true`, and never cleared: a later acceptance does not make
 * the refusal untrue, and clearing it would let a revocation start the
 * automatic promotion over again. The pair reads coherently because this
 * setting is about the *offer*, not about consent state - "this user declined a
 * promotion once" stays true after they later accept from the composer.
 */
export async function recordConsentOfferDeclined(): Promise<void> {
  const response = await api.storeSetting(
    AGENT_CONSENT_OFFER_DECLINED_SETTING_ID,
    true
  )
  if (!response.ok) {
    throw new ConsentOfferDeclinedWriteError(
      `Failed to store consent refusal (${response.status})`
    )
  }

  // Update memory only after the server accepted the refusal. If the request
  // fails, a later Reject in this page must still be able to retry it.
  useSettingStore().settingValues[AGENT_CONSENT_OFFER_DECLINED_SETTING_ID] =
    true
}
