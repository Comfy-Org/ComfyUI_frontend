import { billingClientKey } from '@comfyorg/account/vue'
import type { FirebaseApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import type { Pinia } from 'pinia'
import type { App } from 'vue'
import { until } from '@vueuse/core'

import {
  clearAccountLayerPocExchangeError,
  createFrontendAccountClients,
  getAccountLayerPocDebug,
  setAccountLayerPocExchangeError
} from '@/platform/account/accountClient'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

export function installAccountLayerPoc(
  app: App,
  pinia: Pinia,
  firebaseApp: FirebaseApp
) {
  const auth = getAuth(firebaseApp)
  const accountClients = createFrontendAccountClients(
    auth,
    () => useTeamWorkspaceStore(pinia).activeWorkspaceId
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
