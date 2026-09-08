/**
 * Global settings contract coverage (BE-12346).
 *
 * This lives outside `src/` because `openapi-ts.config.ts` sets
 * `output.clean`: regeneration wipes that directory, and the cloud→frontend
 * vendoring workflow commits only `packages/ingest-types/src/`.
 *
 * The type-level assertions are checked by `pnpm typecheck`, which the root
 * tsconfig covers this directory for; vitest erases them.
 */
import { describe, expect, expectTypeOf, it } from 'vitest'

import type {
  AgentConsentSettingValue,
  GlobalSetting,
  GlobalSettingKey,
  GlobalSettingValue
} from '../src/index.ts'
import {
  zAgentConsentSettingValue,
  zGlobalSetting,
  zGlobalSettingKey,
  zGlobalSettingValue
} from '../src/zod.gen.ts'

const CONSENT_KEY = 'Comfy.AgentPanel.ConsentAccepted' as const

/**
 * `Extract` selects the sole member today and exactly the matching member once
 * a second key joins the union, so these assertions cannot pass by accident.
 */
type NarrowByKey<T, K extends GlobalSettingKey> = Extract<T, { key: K }>

describe('the emitted types are key-discriminated', () => {
  it('narrows to the matching value schema', () => {
    expectTypeOf<
      NarrowByKey<GlobalSettingValue, typeof CONSENT_KEY>['value']
    >().toEqualTypeOf<true>()
    expectTypeOf<
      NarrowByKey<GlobalSettingValue, typeof CONSENT_KEY>
    >().toExtend<AgentConsentSettingValue>()
    expectTypeOf<
      NarrowByKey<GlobalSetting, typeof CONSENT_KEY>['value']
    >().toEqualTypeOf<true>()
    expectTypeOf<
      NarrowByKey<GlobalSetting, typeof CONSENT_KEY>['updated_at']
    >().toEqualTypeOf<string>()
  })

  it('lets a caller read the value with no cast or schema lookup', () => {
    const readConsent = (setting: GlobalSetting): true => setting.value

    expect(
      readConsent({
        key: CONSENT_KEY,
        value: true,
        updated_at: '2026-09-08T00:00:00Z'
      })
    ).toBe(true)
  })

  it('rejects a key the registry does not publish', () => {
    // Each directive sits on the offending property, which is the line
    // TypeScript reports the mismatch on, and fails typecheck as an unused
    // directive if the key set ever stops being closed.
    const unregisteredWrite: GlobalSettingValue = {
      // @ts-expect-error 'Comfy.Unregistered' is not a registered setting key
      key: 'Comfy.Unregistered',
      value: true
    }
    // @ts-expect-error 'Comfy.Unregistered' is not a registered setting key
    const unregisteredKey: GlobalSettingKey = 'Comfy.Unregistered'
    const revokeByFalse: GlobalSettingValue = {
      key: CONSENT_KEY,
      // @ts-expect-error revocation is DELETE, so `false` is not writable
      value: false
    }

    expect([unregisteredWrite, unregisteredKey, revokeByFalse]).toHaveLength(3)
  })
})

describe('the shipped Zod schemas enforce the same contract', () => {
  it('accepts the published write and read shapes', () => {
    expect(
      zGlobalSettingValue.parse({ key: CONSENT_KEY, value: true })
    ).toEqual({ key: CONSENT_KEY, value: true })
    expect(
      zAgentConsentSettingValue.parse({ key: CONSENT_KEY, value: true })
    ).toEqual({ key: CONSENT_KEY, value: true })
    expect(zGlobalSettingKey.parse(CONSENT_KEY)).toBe(CONSENT_KEY)

    const stored = {
      key: CONSENT_KEY,
      value: true,
      updated_at: '2026-09-08T00:00:00Z'
    }
    expect(zGlobalSetting.parse(stored)).toEqual(stored)
  })

  it('rejects an unregistered key and a non-`true` value', () => {
    expect(
      zGlobalSettingValue.safeParse({ key: 'Comfy.Unregistered', value: true })
        .success
    ).toBe(false)
    expect(zGlobalSettingKey.safeParse('Comfy.Unregistered').success).toBe(
      false
    )
    expect(
      zGlobalSettingValue.safeParse({ key: CONSENT_KEY, value: false }).success
    ).toBe(false)
    expect(
      zGlobalSettingValue.safeParse({ key: CONSENT_KEY, value: 'true' }).success
    ).toBe(false)
  })

  it('requires a timestamp on a stored setting', () => {
    expect(
      zGlobalSetting.safeParse({ key: CONSENT_KEY, value: true }).success
    ).toBe(false)
    expect(
      zGlobalSetting.safeParse({
        key: CONSENT_KEY,
        value: true,
        updated_at: 'not-a-timestamp'
      }).success
    ).toBe(false)
  })
})
