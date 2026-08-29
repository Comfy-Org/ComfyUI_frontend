import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { RemoteConfig } from '@/platform/remoteConfig/types'

const registered = vi.hoisted(() => ({
  setup: null as (() => Promise<void> | void) | null
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({
    registerExtension: (extension: { setup?: () => Promise<void> | void }) => {
      registered.setup = extension.setup ?? null
    }
  })
}))

interface GateHarness {
  store: { enabled: boolean }
  setConfig(
    state: 'anonymous' | 'authenticated',
    config: RemoteConfig
  ): Promise<void>
}

// The gate's flag chain reads module-load state (__DISTRIBUTION__ folds into
// isCloud at import time), so every boot re-imports a fresh module graph and
// every handle must come from that same graph.
async function bootGate(): Promise<GateHarness> {
  vi.stubGlobal('__DISTRIBUTION__', 'cloud')
  vi.resetModules()
  const { createPinia, setActivePinia } = await import('pinia')
  setActivePinia(createPinia())
  const remote = await import('@/platform/remoteConfig/remoteConfig')
  const { registerAgentPanelExtension } = await import('./agentPanel')
  registerAgentPanelExtension()
  await registered.setup?.()
  const { useAgentPanelStore } =
    await import('@/workbench/extensions/agent/stores/agentPanelStore')
  const { nextTick } = await import('vue')
  const store = useAgentPanelStore()
  return {
    store,
    async setConfig(state, config) {
      remote.remoteConfig.value = config
      remote.remoteConfigState.value = state
      // The fresh graph's own nextTick flushes its watchEffect scheduler.
      await nextTick()
    }
  }
}

describe('the agent panel flag gate', () => {
  beforeEach(() => {
    registered.setup = null
    localStorage.clear()
  })

  it('stays dark on anonymous config even when it carries the flag', async () => {
    const gate = await bootGate()
    await gate.setConfig('anonymous', { 'agent-in-app-experience': true })

    expect(gate.store.enabled).toBe(false)
  })

  it('enables on authenticated config that carries the flag', async () => {
    const gate = await bootGate()
    await gate.setConfig('authenticated', { 'agent-in-app-experience': true })

    expect(gate.store.enabled).toBe(true)
  })

  it('stays dark when authenticated config lacks the flag', async () => {
    const gate = await bootGate()
    await gate.setConfig('authenticated', {})

    expect(gate.store.enabled).toBe(false)
  })

  it('follows a config flip in both directions', async () => {
    const gate = await bootGate()
    await gate.setConfig('authenticated', { 'agent-in-app-experience': true })
    expect(gate.store.enabled).toBe(true)

    await gate.setConfig('authenticated', {})
    expect(gate.store.enabled).toBe(false)

    await gate.setConfig('authenticated', { 'agent-in-app-experience': true })
    expect(gate.store.enabled).toBe(true)
  })

  it('registers nothing off-cloud', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'localhost')
    vi.resetModules()
    const { registerAgentPanelExtension } = await import('./agentPanel')
    registerAgentPanelExtension()

    expect(registered.setup).toBeNull()
  })

  it('the ff: localStorage override wins in both directions', async () => {
    localStorage.setItem('ff:agent-in-app-experience', 'true')
    const enabledGate = await bootGate()
    await enabledGate.setConfig('anonymous', {})
    expect(enabledGate.store.enabled).toBe(true)

    localStorage.setItem('ff:agent-in-app-experience', 'false')
    const disabledGate = await bootGate()
    await disabledGate.setConfig('authenticated', {
      'agent-in-app-experience': true
    })
    expect(disabledGate.store.enabled).toBe(false)
  })
})
