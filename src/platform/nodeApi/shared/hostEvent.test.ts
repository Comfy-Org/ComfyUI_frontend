import { reportError } from '@comfyorg/telemetry/reportError'
import { effectScope, shallowRef, watch } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { createHostEvent } from './hostEvent'

function followedHost() {
  const followers = new Set<(value: number) => void>()
  const follow = vi.fn((emit: (value: number) => void) => {
    followers.add(emit)
    return () => followers.delete(emit)
  })
  const send = (value: number) => {
    for (const emit of followers) emit(value)
  }
  return { follow, send, followers }
}

describe('host events', () => {
  it('follows the host once for every listener and passes on what it sends', () => {
    const { follow, send } = followedHost()
    const onChange = createHostEvent('onChange', follow)
    const first = vi.fn()
    const second = vi.fn()
    onChange(first)
    onChange(second)

    send(7)

    expect(follow).toHaveBeenCalledOnce()
    expect(first).toHaveBeenCalledExactlyOnceWith(7)
    expect(second).toHaveBeenCalledExactlyOnceWith(7)
  })

  it('stops following the host when the last listener leaves, and follows again for a new one', () => {
    const { follow, send, followers } = followedHost()
    const onChange = createHostEvent('onChange', follow)
    const stopFirst = onChange(vi.fn())
    const stopSecond = onChange(vi.fn())

    stopFirst()

    expect(followers.size).toBe(1)

    stopSecond()
    stopSecond()

    expect(followers.size).toBe(0)

    const again = vi.fn()
    onChange(again)
    stopFirst()
    send(1)

    expect(follow).toHaveBeenCalledTimes(2)
    expect(again).toHaveBeenCalledOnce()
  })

  it('reports a listener that throws and still calls the rest', () => {
    const { follow, send } = followedHost()
    const onChange = createHostEvent('onChange', follow)
    const broken = new Error('pack failed')
    const after = vi.fn()
    onChange(() => {
      throw broken
    })
    onChange(after)

    send(1)

    expect(after).toHaveBeenCalledOnce()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(broken, {
      errorType: 'node_api_listener_failure',
      surface: 'platform',
      tags: { event: 'onChange' }
    })
  })

  it('refuses a listener that is not a function, without following the host', () => {
    const { follow } = followedHost()
    const onChange = createHostEvent('onChange', follow)

    expect(() => Reflect.apply(onChange, undefined, ['listener'])).toThrow(
      "onChange needs a function to call, not 'listener'."
    )
    expect(follow).not.toHaveBeenCalled()
  })

  it('keeps following the host after the scope the first listener subscribed in ends', () => {
    const value = shallowRef(0)
    const onChange = createHostEvent<[number]>('onChange', (emit) =>
      watch(value, (next) => emit(next), { flush: 'sync' })
    )
    const packComponent = effectScope()
    packComponent.run(() => onChange(vi.fn()))
    const otherPack = vi.fn()
    onChange(otherPack)

    value.value = 1
    packComponent.stop()
    value.value = 2

    expect(otherPack.mock.calls).toEqual([[1], [2]])
  })
})
