import { describe, expect, it } from 'vitest'

import {
  getFirebaseConfigForEnvironment,
  getFirebaseAuthEmulatorUrl
} from '@/config/firebase'

describe('firebase config', () => {
  it('uses the explicit local project id when the auth emulator is enabled', () => {
    const config = getFirebaseConfigForEnvironment({
      isCloudBuild: false,
      useProdConfig: false,
      authEmulatorHost: '127.0.0.1:9099',
      localProjectId: 'demo-cloud'
    })

    expect(config.projectId).toBe('demo-cloud')
    expect(config.authDomain).toBe('demo-cloud.firebaseapp.com')
  })

  it('fails fast when the auth emulator is enabled without a local project id', () => {
    expect(() =>
      getFirebaseConfigForEnvironment({
        isCloudBuild: false,
        useProdConfig: false,
        authEmulatorHost: '127.0.0.1:9099'
      })
    ).toThrow('VITE_FIREBASE_PROJECT_ID is required')
  })

  it('does not connect to the emulator without the explicit host flag', () => {
    expect(getFirebaseAuthEmulatorUrl(undefined)).toBeNull()
    expect(getFirebaseAuthEmulatorUrl('127.0.0.1:9099')).toBe(
      'http://127.0.0.1:9099'
    )
  })
})
