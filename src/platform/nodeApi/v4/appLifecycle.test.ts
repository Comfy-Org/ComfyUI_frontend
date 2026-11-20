import { reportError } from '@comfyorg/telemetry/reportError'
import { describe, expect, it, vi } from 'vitest'

import { createAppLifecycle } from './appLifecycle'
import { expectRefusal } from '@/platform/nodeApi/v4/__tests__/refusal'

describe('app readiness', () => {
  it('holds a listener until the host says the app is ready', () => {
    const lifecycle = createAppLifecycle()
    const listener = vi.fn()
    lifecycle.onReady(listener)

    expect(listener).not.toHaveBeenCalled()

    lifecycle.markReady()

    expect(listener).toHaveBeenCalledOnce()
  })

  it('runs a listener added after readiness on the next microtask, not inside the call', async () => {
    const lifecycle = createAppLifecycle()
    lifecycle.markReady()
    const listener = vi.fn()

    lifecycle.onReady(listener)

    expect(listener).not.toHaveBeenCalled()

    await Promise.resolve()

    expect(listener).toHaveBeenCalledOnce()
  })

  it('runs each listener once, however often readiness is signaled', async () => {
    const lifecycle = createAppLifecycle()
    const early = vi.fn()
    const late = vi.fn()
    lifecycle.onReady(early)

    lifecycle.markReady()
    lifecycle.onReady(late)
    lifecycle.markReady()
    await Promise.resolve()

    expect(early).toHaveBeenCalledOnce()
    expect(late).toHaveBeenCalledOnce()
  })

  it.for([
    { name: 'before readiness', readyFirst: false },
    { name: 'after readiness, before its microtask', readyFirst: true }
  ])('never runs a listener unsubscribed $name', async ({ readyFirst }) => {
    const lifecycle = createAppLifecycle()
    const control = vi.fn()
    const listener = vi.fn()
    if (readyFirst) lifecycle.markReady()

    const stop = lifecycle.onReady(listener)
    lifecycle.onReady(control)
    stop()
    lifecycle.markReady()
    await Promise.resolve()

    expect(listener).not.toHaveBeenCalled()
    expect(control).toHaveBeenCalledOnce()
  })

  it('runs a listener that another listener adds while the app becomes ready', async () => {
    const lifecycle = createAppLifecycle()
    const nested = vi.fn()
    lifecycle.onReady(() => lifecycle.onReady(nested))

    lifecycle.markReady()
    await Promise.resolve()

    expect(nested).toHaveBeenCalledOnce()
  })

  it.for([undefined, null, 'ready', {}])(
    'refuses %j as a listener when it is offered, not when the app becomes ready',
    (listener) => {
      const lifecycle = createAppLifecycle()

      expectRefusal(
        () => Reflect.apply(lifecycle.onReady, lifecycle, [listener]),
        'onReady'
      )

      lifecycle.markReady()

      expect(reportError).not.toHaveBeenCalled()
    }
  )

  it('reports a listener that throws and still runs the others', () => {
    const lifecycle = createAppLifecycle()
    const broken = new Error('setup failed')
    const after = vi.fn()
    lifecycle.onReady(() => {
      throw broken
    })
    lifecycle.onReady(after)

    lifecycle.markReady()

    expect(after).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledWith(
      broken,
      expect.objectContaining({ tags: { event: 'onReady' } })
    )
  })
})
