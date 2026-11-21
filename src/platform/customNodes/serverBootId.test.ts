import { describe, expect, it, vi } from 'vitest'

import { api } from '@/scripts/api'

const distribution = vi.hoisted(() => ({ isCloud: false }))

vi.mock(import('@/platform/distribution/types'), () => distribution)

import { bootIdOf, serverReportsBootId } from './serverBootId'

describe('bootIdOf', () => {
  it('reads a non-empty string server_boot_id flag', () => {
    expect(bootIdOf({ server_boot_id: 'boot-1' })).toBe('boot-1')
  })

  it.for([
    { case: 'missing', flags: {} },
    { case: 'empty string', flags: { server_boot_id: '' } },
    { case: 'non-string', flags: { server_boot_id: 1 } },
    { case: 'not an object', flags: 'boot-1' },
    { case: 'null', flags: null }
  ])('returns undefined when the flag is $case', ({ flags }) => {
    expect(bootIdOf(flags)).toBeUndefined()
  })
})

describe('serverReportsBootId', () => {
  it('is true when the connected server reports a boot id', () => {
    distribution.isCloud = false
    api.serverFeatureFlags.value = { server_boot_id: 'boot-1' }

    expect(serverReportsBootId()).toBe(true)
  })

  it('is false on cloud even when the server reports a boot id', () => {
    distribution.isCloud = true
    api.serverFeatureFlags.value = { server_boot_id: 'boot-1' }

    expect(serverReportsBootId()).toBe(false)
  })
})
