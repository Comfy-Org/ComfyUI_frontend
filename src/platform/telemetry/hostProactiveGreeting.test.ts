import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { reportError } from '@comfyorg/telemetry/reportError'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

vi.mock(import('@/platform/remoteConfig/remoteConfig'))
vi.mock(import('@comfyorg/telemetry/reportError'))
const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock(import('@/platform/distribution/types'), () => distribution)
beforeEach(() => {
  remoteConfig.value = { enable_telemetry: true }
  distribution.isCloud = true
})

import {
  getHostProactiveGreetingAdmission,
  requiresHostProactiveGreetingAdmission,
  subscribeToHostProactiveGreetingAdmission,
  supportsHostProactiveGreeting
} from './hostProactiveGreeting'

afterEach(() => {
  delete window.__comfyDesktop2
})

function installHost(
  getProactiveGreetingAdmission: (userId: string) => Promise<unknown>,
  onProactiveGreetingAdmissionChanged = () => () => undefined
) {
  window.__comfyDesktop2 = {
    Telemetry: Object.assign(
      { capture: vi.fn() },
      {
        proactiveGreetingExperimentVersion: 2,
        getProactiveGreetingAdmission,
        enrollProactiveGreeting: async () => true,
        onProactiveGreetingAdmissionChanged
      }
    )
  }
}

it.for([
  { cloud: true, bridge: undefined, required: false },
  { cloud: false, bridge: undefined, required: true },
  { cloud: true, bridge: { Telemetry: { capture: vi.fn() } }, required: true },
  { cloud: false, bridge: { Telemetry: { capture: vi.fn() } }, required: true }
])(
  'requires host admission for cloud=$cloud bridge=$bridge',
  ({ cloud, bridge, required }) => {
    distribution.isCloud = cloud
    window.__comfyDesktop2 = bridge
    expect(requiresHostProactiveGreetingAdmission()).toBe(required)
  }
)

it('leaves ordinary browsers and old hosts outside the experiment', async () => {
  expect(supportsHostProactiveGreeting()).toBe(false)
  expect(await getHostProactiveGreetingAdmission('user-a')).toBe('denied')
  window.__comfyDesktop2 = {
    isRemote: () => false,
    Telemetry: Object.assign(
      { capture: vi.fn() },
      {
        proactiveGreetingExperimentVersion: 1,
        canEnrollProactiveGreeting: async () => true
      }
    )
  }
  expect(supportsHostProactiveGreeting()).toBe(false)
  expect(await getHostProactiveGreetingAdmission('user-a')).toBe('denied')
})

it.for([
  { response: 'allowed', expected: 'allowed' },
  { response: 'verify-firebase', expected: 'verify-firebase' },
  { response: 'denied', expected: 'denied' },
  { response: true, expected: 'denied' },
  { response: undefined, expected: 'denied' }
])(
  'uses only supported Desktop admission outcomes: $response',
  async ({ response, expected }) => {
    const getProactiveGreetingAdmission = vi.fn().mockResolvedValue(response)
    installHost(getProactiveGreetingAdmission)
    expect(supportsHostProactiveGreeting()).toBe(true)
    expect(await getHostProactiveGreetingAdmission('user-a')).toBe(expected)
    expect(getProactiveGreetingAdmission).toHaveBeenCalledExactlyOnceWith(
      'user-a',
      undefined
    )
    expect(reportError).not.toHaveBeenCalled()
  }
)

it('fails closed and reports a sanitized warning once when host admission throws', async () => {
  installHost(
    vi.fn().mockRejectedValue(new Error('disconnected for user-a, token-a'))
  )

  expect(await getHostProactiveGreetingAdmission('user-a', 'token-a')).toBe(
    'denied'
  )
  expect(await getHostProactiveGreetingAdmission('user-b', 'token-b')).toBe(
    'denied'
  )
  expect(reportError).toHaveBeenCalledExactlyOnceWith(
    new Error('Desktop proactive greeting bridge call failed'),
    {
      errorType: 'failure_in_desktop_proactive_greeting_bridge',
      surface: 'agent',
      level: 'warning',
      tags: { operation: 'admission' }
    }
  )
})

it('leaves the subscription unavailable and warns once when the bridge throws', () => {
  installHost(
    async () => 'allowed',
    () => {
      throw new Error('unavailable for workspace-a')
    }
  )

  expect(subscribeToHostProactiveGreetingAdmission(vi.fn())).toBeUndefined()
  expect(subscribeToHostProactiveGreetingAdmission(vi.fn())).toBeUndefined()
  expect(reportError).toHaveBeenCalledExactlyOnceWith(
    new Error('Desktop proactive greeting bridge call failed'),
    {
      errorType: 'failure_in_desktop_proactive_greeting_bridge',
      surface: 'agent',
      level: 'warning',
      tags: { operation: 'subscribe' }
    }
  )
})

it('uses live Desktop admission after frontend config clears the boot-time telemetry flag', async () => {
  const getProactiveGreetingAdmission = vi.fn().mockResolvedValue('allowed')
  installHost(getProactiveGreetingAdmission)
  remoteConfig.value = {}
  expect(await getHostProactiveGreetingAdmission('user-a')).toBe('allowed')
  expect(getProactiveGreetingAdmission).toHaveBeenCalledExactlyOnceWith(
    'user-a',
    undefined
  )
})
