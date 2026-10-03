import { expect, it, vi } from 'vitest'

import { deleteApp, initializeApp } from 'firebase/app'
import { inMemoryPersistence, initializeAuth } from 'firebase/auth'

import {
  createFirebaseIdentity,
  watchedPopupRedirectResolver
} from './index.js'

vi.mock<unknown>(import('firebase/auth'), async () => {
  const { createRequire } = await import('node:module')
  const { dirname, join } = await import('node:path')
  const fromFirebase = createRequire(
    createRequire(import.meta.url).resolve('firebase/package.json')
  )
  const browserBuild = join(
    dirname(fromFirebase.resolve('@firebase/auth/package.json')),
    'dist/esm2017/index.js'
  )
  const sdk: unknown = await import(browserBuild)
  if (typeof sdk !== 'object' || sdk === null) throw new Error('No browser SDK')
  return { ...sdk }
})

it.for([
  { signIn: 'signInWithGoogle', anotherIdentity: false },
  { signIn: 'signInWithGitHub', anotherIdentity: false },
  { signIn: 'signInWithGitHub', anotherIdentity: true }
] as const)(
  'keeps a delayed Google SDK failure recoverable on $signIn with another identity: $anotherIdentity',
  async ({ signIn, anotherIdentity }, { onTestFinished }) => {
    vi.useRealTimers()
    const app = initializeApp(
      {
        apiKey: 'test-api-key',
        authDomain: 'test.firebaseapp.com',
        projectId: 'test'
      },
      'popup-recovery'
    )
    onTestFinished(async () => await deleteApp(app))
    const scripts: HTMLScriptElement[] = []
    const appendChild = document.head.appendChild.bind(document.head)
    vi.spyOn(document.head, 'appendChild').mockImplementation((node) => {
      if (node instanceof HTMLScriptElement) {
        scripts.push(node)
        return node
      }
      return appendChild(node)
    })
    const auth = initializeAuth(app, {
      persistence: inMemoryPersistence,
      popupRedirectResolver: watchedPopupRedirectResolver
    })
    const identity = createFirebaseIdentity({ auth, watchPopupSignIn: true })
    const repeatIdentity = anotherIdentity
      ? createFirebaseIdentity({ auth, watchPopupSignIn: true })
      : identity
    await auth.authStateReady()

    const first = identity.signInWithGoogle().catch((error: unknown) => error)
    await vi.waitFor(() => {
      expect(scripts).toHaveLength(1)
    })

    const repeated = repeatIdentity[signIn]().catch((error: unknown) => error)
    scripts[0]?.dispatchEvent(new Event('error'))
    await expect(first).resolves.toMatchObject({ code: 'auth/internal-error' })
    await expect(repeated).resolves.toMatchObject({
      code: 'auth/cancelled-popup-request'
    })

    const retry = identity.signInWithGoogle().catch((error: unknown) => error)
    await vi.waitFor(() => {
      expect(scripts).toHaveLength(2)
    })
    scripts[1]?.dispatchEvent(new Event('error'))
    await expect(retry).resolves.toMatchObject({ code: 'auth/internal-error' })
  }
)
