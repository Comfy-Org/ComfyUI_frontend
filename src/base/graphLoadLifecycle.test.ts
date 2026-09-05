import { describe, expect, expectTypeOf, it, vi } from 'vitest'

import type { GraphLoadToken } from './graphLoadLifecycle'
import {
  beginGraphLoad,
  beginGraphLoadScope,
  onGraphLoadLifecycle,
  setGraphLoadLifecycleErrorReporter
} from './graphLoadLifecycle'

const errorReporterMock = vi.hoisted(() => vi.fn())

describe('graphLoadLifecycle', () => {
  it('exposes only tokens created by beginGraphLoad', () => {
    expectTypeOf(Symbol()).not.toMatchTypeOf<GraphLoadToken>()
    expectTypeOf(beginGraphLoad).returns.toEqualTypeOf<GraphLoadToken>()
  })

  it('settles a load scope exactly once across explicit and scope-exit disposal', () => {
    const events: string[] = []
    const stop = onGraphLoadLifecycle(({ type }) => events.push(type))

    try {
      {
        using scope = beginGraphLoadScope()
        scope[Symbol.dispose]()
        scope[Symbol.dispose]()
      }
    } finally {
      stop()
    }

    expect(events).toEqual(['started', 'settled'])
  })

  it('settles a load scope when its block throws', () => {
    const events: string[] = []
    const stop = onGraphLoadLifecycle(({ type }) => events.push(type))

    try {
      expect(() => {
        using _scope = beginGraphLoadScope()
        throw new Error('load failed')
      }).toThrow('load failed')
    } finally {
      stop()
    }

    expect(events).toEqual(['started', 'settled'])
  })

  it('reports throwing listeners without interrupting lifecycle delivery', () => {
    const failure = new Error('listener failed')
    const events: string[] = []
    setGraphLoadLifecycleErrorReporter(errorReporterMock)
    const stopThrowing = onGraphLoadLifecycle(() => {
      throw failure
    })
    const stopRecording = onGraphLoadLifecycle(({ type }) => events.push(type))

    try {
      using _scope = beginGraphLoadScope()
    } finally {
      stopThrowing()
      stopRecording()
      setGraphLoadLifecycleErrorReporter(null)
    }

    expect(events).toEqual(['started', 'settled'])
    expect(errorReporterMock).toHaveBeenCalledTimes(2)
    expect(errorReporterMock).toHaveBeenNthCalledWith(
      1,
      failure,
      expect.objectContaining({ type: 'started' })
    )
    expect(errorReporterMock).toHaveBeenNthCalledWith(
      2,
      failure,
      expect.objectContaining({ type: 'settled' })
    )
  })
})
