import { afterEach, beforeEach, expect, it, vi } from 'vitest'

import { remoteConfig } from '@/platform/remoteConfig/remoteConfig'

vi.mock(import('@/platform/remoteConfig/remoteConfig'))
beforeEach(() => {
  remoteConfig.value = { enable_telemetry: true }
})

import {
  canEnrollHostProactiveGreeting,
  supportsHostProactiveGreeting
} from './hostProactiveGreeting'

afterEach(() => {
  delete window.__comfyDesktop2
})

it('leaves ordinary browsers and old hosts outside the experiment', async () => {
  expect(supportsHostProactiveGreeting()).toBe(false)
  expect(await canEnrollHostProactiveGreeting('user-a')).toBe(false)
  window.__comfyDesktop2 = {
    isRemote: () => false,
    Telemetry: { capture: vi.fn() }
  }
  expect(supportsHostProactiveGreeting()).toBe(false)
  expect(await canEnrollHostProactiveGreeting('user-a')).toBe(false)
})

it.for([true, false, undefined])(
  'requires explicit host admission for the current actor: %s',
  async (admitted) => {
    const canEnrollProactiveGreeting = vi.fn().mockResolvedValue(admitted)
    window.__comfyDesktop2 = {
      isRemote: () => false,
      Telemetry: Object.assign(
        { capture: vi.fn() },
        { proactiveGreetingExperimentVersion: 1, canEnrollProactiveGreeting }
      )
    }
    expect(supportsHostProactiveGreeting()).toBe(true)
    expect(await canEnrollHostProactiveGreeting('user-a')).toBe(
      admitted === true
    )
    expect(canEnrollProactiveGreeting).toHaveBeenCalledExactlyOnceWith('user-a')
  }
)

it('fails closed when the host admission request fails', async () => {
  window.__comfyDesktop2 = {
    isRemote: () => false,
    Telemetry: Object.assign(
      { capture: vi.fn() },
      {
        proactiveGreetingExperimentVersion: 1,
        canEnrollProactiveGreeting: vi
          .fn()
          .mockRejectedValue(new Error('disconnected'))
      }
    )
  }
  expect(await canEnrollHostProactiveGreeting('user-a')).toBe(false)
})

it('honors the existing frontend telemetry feature gate before host admission', async () => {
  const canEnrollProactiveGreeting = vi.fn().mockResolvedValue(true)
  window.__comfyDesktop2 = {
    isRemote: () => false,
    Telemetry: Object.assign(
      { capture: vi.fn() },
      {
        proactiveGreetingExperimentVersion: 1,
        canEnrollProactiveGreeting
      }
    )
  }
  remoteConfig.value = { enable_telemetry: false }
  expect(await canEnrollHostProactiveGreeting('user-a')).toBe(false)
  expect(canEnrollProactiveGreeting).not.toHaveBeenCalled()
})
