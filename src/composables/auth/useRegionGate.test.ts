import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { useRegionGate } from '@/composables/auth/useRegionGate'

const detection = vi.hoisted(() => ({
  outcome: Promise.resolve(false)
}))
vi.mock('@/utils/networkUtil', () => ({
  isInChina: () => detection.outcome
}))

const GateHost = defineComponent({
  setup() {
    const { status } = useRegionGate()
    return () => h('output', status.value)
  }
})

const currentStatus = () => screen.getByRole('status').textContent

beforeEach(() => {
  detection.outcome = Promise.resolve(false)
})

describe('useRegionGate', () => {
  it('starts pending so callers cannot render before the region is known', () => {
    render(GateHost)

    expect(
      currentStatus(),
      'detection bounds itself, so no deadline here may answer on its behalf'
    ).toBe('pending')
  })

  it.for([
    ['blocked', true],
    ['allowed', false]
  ] as const)('resolves to %s', async ([expected, inChina]) => {
    detection.outcome = Promise.resolve(inChina)
    render(GateHost)

    await waitFor(() => expect(currentStatus()).toBe(expected))
  })

  it('fails open when detection rejects', async () => {
    detection.outcome = Promise.reject(new Error('probe exploded'))
    render(GateHost)

    await waitFor(() => expect(currentStatus()).toBe('allowed'))
  })

  it('waits for a slow blocked answer rather than pre-empting it', async () => {
    vi.useFakeTimers()
    let settle!: (inChina: boolean) => void
    detection.outcome = new Promise<boolean>((resolve) => {
      settle = resolve
    })
    render(GateHost)

    await vi.advanceTimersByTimeAsync(60_000)
    expect(currentStatus()).toBe('pending')

    settle(true)
    await vi.advanceTimersByTimeAsync(0)
    vi.useRealTimers()

    await waitFor(() => expect(currentStatus()).toBe('blocked'))
  })
})
