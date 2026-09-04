import { billingClientKey } from '@comfyorg/account/vue'
import type { FirebaseApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import type { Pinia } from 'pinia'
import type { App } from 'vue'
import { until } from '@vueuse/core'
import { loadStripe } from '@stripe/stripe-js/pure'

import {
  clearAccountLayerPocExchangeError,
  createFrontendAccountClients,
  getAccountLayerPocDebug,
  setAccountLayerPocExchangeError,
  setAccountLayerPocWorkspaceDebug
} from '@/platform/account/accountClient'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

export function installAccountLayerPoc(
  app: App,
  pinia: Pinia,
  firebaseApp: FirebaseApp
) {
  const auth = getAuth(firebaseApp)
  const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  const stripePromise = publishableKey
    ? loadStripe(publishableKey)
    : Promise.resolve(null)
  const accountClients = createFrontendAccountClients(
    auth,
    () => useTeamWorkspaceStore(pinia).activeWorkspaceId,
    async (clientSecret) => {
      const stripe = await stripePromise
      if (!stripe) return { error: { message: 'Stripe is unavailable' } }
      const result = await stripe.handleNextAction({ clientSecret })
      if (!result.error) return {}
      return {
        error: {
          message: result.error.message ?? 'Authentication failed',
          ...(result.error.code ? { code: result.error.code } : {})
        }
      }
    }
  )
  app.provide(billingClientKey, accountClients.billing)
  Object.assign(window, { __accountLayerPoc: getAccountLayerPocDebug() })

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      clearAccountLayerPocExchangeError()
      void accountClients.session.clearSession()
      return
    }
    clearAccountLayerPocExchangeError()
    try {
      const workspaceStore = useTeamWorkspaceStore(pinia)
      await workspaceStore.initialize()
      setAccountLayerPocWorkspaceDebug({
        initState: workspaceStore.initState,
        error: workspaceStore.error?.message ?? null,
        activeWorkspaceId: workspaceStore.activeWorkspaceId,
        workspaces: workspaceStore.workspaces.map(({ id, type }) => ({
          id,
          type
        }))
      })
      await until(() => workspaceStore.initState).toMatch(
        (state) => state === 'ready' || state === 'error'
      )
      if (workspaceStore.initState !== 'ready') {
        throw (
          workspaceStore.error ?? new Error('Workspace initialization failed')
        )
      }
      await accountClients.session.establishSession()
      await accountClients.billingCommands.start()
      await accountClients.billing.refreshCredits()
    } catch (error) {
      setAccountLayerPocExchangeError(error)
    }
  })
}
