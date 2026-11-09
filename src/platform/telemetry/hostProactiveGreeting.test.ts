import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

vi.mock(import('@/platform/remoteConfig/remoteConfig'))
const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock(import('@/platform/distribution/types'), () => distribution)
beforeEach(() => {
  remoteConfig.value = { enable_telemetry: true }
  distribution.isCloud = true
})

import {
  getHostProactiveGreetingAdmission,
  requiresHostProactiveGreetingAdmission,
  supportsHostProactiveGreeting
} from './hostProactiveGreeting'

afterEach(() => {
  delete window.__comfyDesktop2
})

function installHost(
  getProactiveGreetingAdmission: (userId: string) => Promise<unknown>
) {
  window.__comfyDesktop2 = {
    Telemetry: Object.assign(
      { capture: vi.fn() },
      {
        proactiveGreetingExperimentVersion: 2,
        getProactiveGreetingAdmission,
        enrollProactiveGreeting: async () => true,
        onProactiveGreetingAdmissionChanged: () => () => undefined
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
  }
)

it('fails closed when the host admission request fails', async () => {
  installHost(vi.fn().mockRejectedValue(new Error('disconnected')))
  expect(await getHostProactiveGreetingAdmission('user-a')).toBe('denied')
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
