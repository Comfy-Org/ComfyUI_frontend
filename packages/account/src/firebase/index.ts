import { getApp, getApps, initializeApp } from 'firebase/app'
import type { FirebaseApp, FirebaseOptions } from 'firebase/app'
import {
  browserLocalPersistence,
  browserSessionPersistence,
  getAuth,
  indexedDBLocalPersistence,
  inMemoryPersistence,
  onAuthStateChanged,
  setPersistence
} from 'firebase/auth'
import type { Auth, Persistence, User } from 'firebase/auth'

import type { IdentityPort, IdentitySnapshot } from '../core/index.js'

export interface FirebaseIdentityConfig {
  app?: FirebaseApp
  options?: FirebaseOptions
  persistence?: 'local' | 'session' | 'memory' | 'indexedDB'
  auth?: Auth
}

export interface FirebaseIdentity extends IdentityPort {
  auth: Auth
  dispose(): void
}

const persistenceByName: Record<
  NonNullable<FirebaseIdentityConfig['persistence']>,
  Persistence
> = {
  local: browserLocalPersistence,
  session: browserSessionPersistence,
  memory: inMemoryPersistence,
  indexedDB: indexedDBLocalPersistence
}

export function createFirebaseIdentity(
  config: FirebaseIdentityConfig
): FirebaseIdentity {
  const auth =
    config.auth ??
    getAuth(
      config.app ??
        (getApps().length > 0 ? getApp() : initializeApp(config.options ?? {}))
    )
  const persistenceReady = setPersistence(
    auth,
    persistenceByName[config.persistence ?? 'local']
  )
  const subscriptions = new Set<() => void>()

  async function snapshot(
    user: User | null,
    forceRefresh = false
  ): Promise<IdentitySnapshot | null> {
    if (!user) return null
    return { userId: user.uid, token: await user.getIdToken(forceRefresh) }
  }

  return {
    auth,
    async acquire(options) {
      await persistenceReady
      return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(
          auth,
          (user) => {
            unsubscribe()
            subscriptions.delete(unsubscribe)
            void snapshot(user, options?.forceRefresh).then(resolve, reject)
          },
          reject
        )
        subscriptions.add(unsubscribe)
      })
    },
    subscribe(listener) {
      const unsubscribe = onAuthStateChanged(auth, (user) => {
        void snapshot(user).then(listener)
      })
      subscriptions.add(unsubscribe)
      return () => {
        unsubscribe()
        subscriptions.delete(unsubscribe)
      }
    },
    dispose() {
      subscriptions.forEach((unsubscribe) => unsubscribe())
      subscriptions.clear()
    }
  }
}
