import { render, screen, waitFor } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'

import { useRegionGate } from './regionGate'

const detection = vi.hoisted(() => ({
  outcome: Promise.resolve(false),
  probes: 0
}))
vi.mock(import('@comfyorg/shared-frontend-utils/networkUtil'), () => ({
  isInChina: () => {
    detection.probes += 1
    return detection.outcome
  }
}))

const GateHost = defineComponent({
  setup() {
    const { status } = useRegionGate()
    return () => h('output', status.value)
  }
})

const currentStatus = () => screen.getByRole('status').textContent
const flushPromises = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

beforeEach(() => {
  detection.outcome = Promise.resolve(false)
  detection.probes = 0
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

  it('discards a probe result that lands after the gate was disabled, and probes again on re-enable', async () => {
    let answer!: (inChina: boolean) => void
    detection.outcome = new Promise((resolve) => (answer = resolve))
    const enabled = ref(true)
    const Host = defineComponent({
      setup() {
        const { status } = useRegionGate(enabled)
        return () => h('output', status.value)
      }
    })
    render(Host)
    await waitFor(() => expect(detection.probes).toBe(1))

    enabled.value = false
    answer(true)
    await flushPromises()
    expect(
      currentStatus(),
      'a stale blocked answer must not publish for a gate that is off'
    ).toBe('pending')

    detection.outcome = Promise.resolve(false)
    enabled.value = true
    await waitFor(() => expect(currentStatus()).toBe('allowed'))
    expect(detection.probes).toBe(2)
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

  it('probes only once the host enables the gate, and only once', async () => {
    const enabled = ref(false)
    const Host = defineComponent({
      setup() {
        const { status } = useRegionGate(enabled)
        return () => h('output', status.value)
      }
    })
    render(Host)
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(
      detection.probes,
      'a page the host does not show must not reach the geo edge'
    ).toBe(0)
    expect(currentStatus()).toBe('pending')

    enabled.value = true
    await waitFor(() => expect(currentStatus()).toBe('allowed'))
    enabled.value = false
    enabled.value = true
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(detection.probes).toBe(1)
  })
})
