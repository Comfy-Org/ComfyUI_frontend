import { computed, shallowRef, watch } from 'vue'
import type { Ref } from 'vue'

import { useWorkshopCredits } from '../config/workshop-credits'
import { useWorkshopSession } from '../config/workshop-session-state'

type Session = ReturnType<typeof useWorkshopSession>
type Credits = ReturnType<typeof useWorkshopCredits>

interface Account {
  session: Session
  credits: Credits
}

/**
 * The session and credits singletons start Firebase the first time anything
 * asks for them. A model page is public and mounts its playground for every
 * visitor, so it must not ask until Workshop is on: with the flag off the
 * page reads as static content and the site makes no auth traffic at all
 * (FE-2770). Once started, the account stays started for the page's life.
 */
export function useWorkshopAccountWhen(enabled: Readonly<Ref<boolean>>) {
  const account = shallowRef<Account>()
  watch(
    enabled,
    (on) => {
      if (on && !account.value)
        account.value = {
          session: useWorkshopSession(),
          credits: useWorkshopCredits()
        }
    },
    { immediate: true }
  )

  const notStarted = () =>
    Promise.reject(new Error('Workshop account is not enabled'))

  return {
    user: computed(() => account.value?.session.user.value ?? null),
    session: computed(() => account.value?.session.session.value),
    sessionFailure: computed(() => account.value?.session.sessionFailure.value),
    settled: computed(() => account.value?.session.settled.value ?? false),
    balance: computed<Credits['balance']['value']>(
      () => account.value?.credits.balance.value ?? { status: 'unknown' }
    ),
    ensureFresh: (
      ...args: Parameters<Session['ensureFresh']>
    ): ReturnType<Session['ensureFresh']> =>
      account.value?.session.ensureFresh(...args) ?? notStarted(),
    remint: (
      ...args: Parameters<Session['remint']>
    ): ReturnType<Session['remint']> =>
      account.value?.session.remint(...args) ?? notStarted()
  }
}
