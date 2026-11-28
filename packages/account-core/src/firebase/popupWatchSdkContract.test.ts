import { readFileSync, readdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * The popup watch leans on three things inside the installed Firebase Auth
 * browser build. A Firebase upgrade that changes any of them fails here, so
 * the watch is checked again (against the auth emulator) before it ships.
 */
function firebaseAuthBrowserBuild(): string {
  const fromFirebase = createRequire(
    createRequire(import.meta.url).resolve('firebase/package.json')
  )
  const dist = join(
    dirname(fromFirebase.resolve('@firebase/auth/package.json')),
    'dist/esm2017'
  )
  const bundle = readdirSync(dist).find((file) =>
    /^index-[\w]+\.js$/.test(file)
  )
  if (!bundle) throw new Error(`no Firebase Auth browser bundle in ${dist}`)
  return readFileSync(join(dist, bundle), 'utf8')
}

describe('Firebase Auth internals the popup watch relies on', () => {
  const source = firebaseAuthBrowserBuild()

  it('delivers every popup result through the event manager’s onEvent, looked up when it arrives', () => {
    expect(source).toContain("iframe.register('authEvent'")
    expect(source).toContain('manager.onEvent(iframeEvent.authEvent)')
  })

  it('opens the popup with the provider object signInWithPopup was given', () => {
    expect(source).toMatch(
      /new PopupOperation\(authInternal, "signInViaPopup"[^,]*, provider, resolverInternal\)/
    )
    expect(source).toContain(
      'this.resolver._openPopup(this.auth, this.provider'
    )
  })
})
