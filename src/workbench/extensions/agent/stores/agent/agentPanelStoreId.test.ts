import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useAgentDockMount } from '@/workbench/extensions/agent/composables/useAgentDockMount'

import { useAgentPanelStore } from './agentPanelStore'

vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/composables/billing/useBillingContext'))

/**
 * Regression pin for the duplicate Pinia id `agentPanel`.
 *
 * A second module used to call `defineStore('agentPanel')` with a gate-only
 * `{enabled, isOpen, gateSettled}` shape. Pinia keys stores by id, so the
 * first setup to run won and every later `useAgentPanelStore()` got that
 * instance no matter which module it imported. The dock mount imported the
 * gate-only module and runs first, so the panel resolved a store with no
 * `width` (Fit View computed `NaN` and poisoned `ds.scale`/`ds.offset`) and
 * no `toggleMaximize` (maximize threw a TypeError).
 *
 * Each case instantiates through the dock mount first to reproduce that
 * registration order.
 */
describe('the agentPanel store id', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    vi.stubGlobal('devicePixelRatio', 1)
  })

  it('maximizes the panel through the store the dock mount already registered', () => {
    useAgentDockMount()
    const store = useAgentPanelStore()
    const widthBefore = store.width

    store.toggleMaximize()

    expect(store.width).toBeGreaterThan(widthBefore)
    expect(store.isMaximized).toBe(true)
  })

  it('keeps the panel docked when the full store is active', () => {
    const { docked } = useAgentDockMount()
    const store = useAgentPanelStore()
    store.enabled = true
    store.consentAccepted = true
    store.isOpen = true

    expect(docked.value).toBe(true)
  })
})
