/**
 * The credits balance behind the model page's no-credits gate: the shared web
 * session's balance when the visitor has one, the Firebase balance otherwise.
 * The session balance loads only in session mode, so Firebase-mode pages
 * carry none of its code.
 */
import type { Ref } from 'vue'
import { computed, shallowRef, watch } from 'vue'

import { useWorkshopAuthFlag } from '../scripts/posthog'
import { resolveWorkshopAccountSource } from './workshop-account-source'
import { useWorkshopCredits } from './workshop-credits'
import type { SessionBalanceState } from './workshop-session-balance'
import type { WorkshopSession } from './workshop-session-state'

type FirebaseBalance = ReturnType<typeof useWorkshopCredits>['balance']['value']

type ModelBalance = FirebaseBalance | SessionBalanceState

type BalanceSource = Readonly<Ref<ModelBalance>>

const UNKNOWN: ModelBalance = { status: 'unknown' }

async function bindSource(
  session: Readonly<Ref<WorkshopSession | undefined>>
): Promise<BalanceSource> {
  if ((await resolveWorkshopAccountSource()) === 'firebase')
    return useWorkshopCredits().balance
  const [{ useWorkshopSessionBalance }, { useWorkshopWebSession }] =
    await Promise.all([
      import('./workshop-session-balance'),
      import('./workshop-web-session-identity')
    ])
  const sessionBalance = useWorkshopSessionBalance(useWorkshopWebSession())
  return computed(() =>
    session.value?.workspace.type === 'personal'
      ? sessionBalance.value
      : UNKNOWN
  )
}

/**
 * The web session's balance is always the personal workspace's, so a team
 * workspace reads unknown and the server's refusal still gates the run.
 */
export function useWorkshopModelBalance(
  session: Readonly<Ref<WorkshopSession | undefined>>
): BalanceSource {
  const authEnabled = useWorkshopAuthFlag()
  const source = shallowRef<BalanceSource>()
  let binding = false
  watch(
    authEnabled,
    (enabled) => {
      if (!enabled || binding || typeof window === 'undefined') return
      binding = true
      void bindSource(session).then((bound) => {
        source.value = bound
      })
    },
    { immediate: true }
  )
  return computed(() => source.value?.value ?? UNKNOWN)
}
