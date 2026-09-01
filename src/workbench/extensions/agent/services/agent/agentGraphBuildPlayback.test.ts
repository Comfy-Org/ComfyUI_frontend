import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  agentGraphBuildPlaybackState,
  cancelAgentGraphNodeBuild,
  pauseAgentGraphBuild,
  resumeAgentGraphBuild,
  skipAgentGraphBuild,
  stageAgentGraphNodeBuild
} from './agentGraphBuildPlayback'

afterEach(() => {
  skipAgentGraphBuild()
})

describe('agent graph build playback', () => {
  it('stages a real node and restores its exact Agent-authored target', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const present = vi.fn()
    const prepare = vi.fn()
    const source = { x: 40, y: 500 }
    const target = { x: 620, y: 120 }

    stageAgentGraphNodeBuild({
      key: 'workflow:1',
      label: 'Sampler',
      source,
      target,
      prepare,
      present,
      toClient: (position) => position,
      durationMs: 0,
      gapMs: 0
    })
    await vi.waitFor(() => expect(present).toHaveBeenCalledWith(target))
    expect(prepare).toHaveBeenCalledOnce()
    expect(present).toHaveBeenLastCalledWith(null)

    expect(agentGraphBuildPlaybackState.value).toMatchObject({
      phase: 'complete',
      current: 1,
      total: 1
    })
    vi.runAllTimers()
  })

  it('bypasses presentation animation for reduced-motion users', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    const target = { x: 620, y: 120 }
    const present = vi.fn()

    stageAgentGraphNodeBuild({
      key: 'workflow:2',
      label: 'Save image',
      source: { x: 40, y: 500 },
      target,
      present,
      toClient: (position) => position
    })
    expect(present).toHaveBeenCalledOnce()
    expect(present).toHaveBeenCalledWith(null)
  })

  it('does not present a node owned by an offscreen graph', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const prepare = vi.fn()
    const present = vi.fn()

    stageAgentGraphNodeBuild({
      key: 'background-workflow:1',
      label: 'Background node',
      source: { x: 20, y: 500 },
      target: { x: 620, y: 120 },
      isPresentable: () => false,
      prepare,
      present,
      toClient: (position) => position
    })

    expect(prepare).not.toHaveBeenCalled()
    expect(present).toHaveBeenCalledOnce()
    expect(present).toHaveBeenCalledWith(null)
  })

  it('drops a queued presentation when its graph leaves the canvas', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    let presentable = true
    const prepare = vi.fn()
    const present = vi.fn()

    stageAgentGraphNodeBuild({
      key: 'workflow-that-was-visible:1',
      label: 'Formerly visible node',
      source: { x: 20, y: 500 },
      target: { x: 620, y: 120 },
      isPresentable: () => presentable,
      prepare,
      present,
      toClient: (position) => position,
      durationMs: 0,
      gapMs: 0
    })
    presentable = false

    await vi.waitFor(() =>
      expect(agentGraphBuildPlaybackState.value.phase).toBe('complete')
    )
    expect(prepare).not.toHaveBeenCalled()
    expect(present).toHaveBeenCalledOnce()
    expect(present).toHaveBeenCalledWith(null)
    vi.runAllTimers()
  })

  it('cleans an active presentation when its graph leaves the canvas', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    let presentable = true
    let resolveFrame: ((time: number) => void) | undefined
    const present = vi.fn()
    const restoreConnections = vi.fn()

    stageAgentGraphNodeBuild({
      key: 'workflow-that-left-mid-drag:1',
      label: 'Interrupted node',
      source: { x: 20, y: 500 },
      target: { x: 620, y: 120 },
      isPresentable: () => presentable,
      present,
      toClient: (position) => position,
      suspendConnections: () => restoreConnections,
      durationMs: 1_000,
      gapMs: 0,
      now: () => 0,
      nextFrame: () =>
        new Promise<number>((resolve) => {
          resolveFrame = resolve
        })
    })
    await vi.waitFor(() => expect(resolveFrame).toBeTypeOf('function'))
    expect(present).toHaveBeenCalledWith({ x: 20, y: 500 })

    presentable = false
    resolveFrame?.(16)

    await vi.waitFor(() =>
      expect(agentGraphBuildPlaybackState.value.phase).toBe('complete')
    )
    expect(present).toHaveBeenLastCalledWith(null)
    expect(restoreConnections).toHaveBeenCalledOnce()
    vi.runAllTimers()
  })

  it('counts a synchronous Agent node batch as one ordered playback', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const firstMove = vi.fn()
    const secondMove = vi.fn()
    const calls: string[] = []
    const restoreConnections = vi.fn()
    const suspendConnections = vi.fn(() => restoreConnections)

    stageAgentGraphNodeBuild({
      key: 'workflow:1',
      label: 'Load image',
      source: { x: 0, y: 500 },
      target: { x: 100, y: 100 },
      prepare: () => calls.push('prepare:first'),
      present: firstMove,
      toClient: (position) => position,
      suspendConnections,
      durationMs: 0,
      gapMs: 0
    })
    stageAgentGraphNodeBuild({
      key: 'workflow:2',
      label: 'Save image',
      source: { x: 0, y: 500 },
      target: { x: 500, y: 100 },
      prepare: () => calls.push('prepare:second'),
      present: secondMove,
      toClient: (position) => position,
      durationMs: 0,
      gapMs: 0
    })

    expect(agentGraphBuildPlaybackState.value).toMatchObject({ total: 2 })
    await vi.waitFor(() =>
      expect(agentGraphBuildPlaybackState.value).toMatchObject({
        phase: 'complete',
        current: 2,
        total: 2
      })
    )
    expect(firstMove).toHaveBeenCalledWith({ x: 100, y: 100 })
    expect(secondMove).toHaveBeenCalledWith({ x: 500, y: 100 })
    expect(firstMove).toHaveBeenLastCalledWith(null)
    expect(secondMove).toHaveBeenLastCalledWith(null)
    expect(calls).toEqual(['prepare:first', 'prepare:second'])
    expect(suspendConnections).toHaveBeenCalledOnce()
    expect(restoreConnections).toHaveBeenCalledOnce()
    vi.runAllTimers()
  })

  it('does not play a queued node after the Agent deletes it', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const deletedMove = vi.fn()

    stageAgentGraphNodeBuild({
      key: 'workflow:deleted',
      label: 'Deleted node',
      source: { x: 0, y: 500 },
      target: { x: 300, y: 100 },
      present: deletedMove,
      toClient: (position) => position,
      durationMs: 0,
      gapMs: 0
    })
    cancelAgentGraphNodeBuild('workflow:deleted')

    await vi.waitFor(() =>
      expect(agentGraphBuildPlaybackState.value.phase).toBe('complete')
    )
    expect(deletedMove).toHaveBeenCalledOnce()
    expect(deletedMove).toHaveBeenCalledWith(null)
    vi.runAllTimers()
  })

  it('skip lands an in-flight real node at its exact final position', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    let resolveFrame: ((time: number) => void) | undefined
    const move = vi.fn()
    const restoreConnections = vi.fn()
    const target = { x: 700, y: 140 }

    stageAgentGraphNodeBuild({
      key: 'workflow:in-flight',
      label: 'KSampler',
      source: { x: 20, y: 500 },
      target,
      present: move,
      toClient: (position) => position,
      suspendConnections: () => restoreConnections,
      durationMs: 1_000,
      gapMs: 0,
      now: () => 0,
      nextFrame: () =>
        new Promise<number>((resolve) => {
          resolveFrame = resolve
        })
    })
    await vi.waitFor(() => expect(resolveFrame).toBeTypeOf('function'))

    skipAgentGraphBuild()
    resolveFrame?.(16)

    await vi.waitFor(() =>
      expect(agentGraphBuildPlaybackState.value.phase).toBe('complete')
    )
    expect(move).toHaveBeenCalledWith(target)
    expect(move).toHaveBeenLastCalledWith(null)
    expect(restoreConnections).toHaveBeenCalledOnce()
    vi.runAllTimers()
  })

  it('does not advance an in-flight node while playback is paused', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const frameResolvers: Array<(time: number) => void> = []
    const move = vi.fn()
    const target = { x: 600, y: 100 }

    stageAgentGraphNodeBuild({
      key: 'workflow:paused',
      label: 'VAE Decode',
      source: { x: 20, y: 500 },
      target,
      present: move,
      toClient: (position) => position,
      durationMs: 1_000,
      gapMs: 0,
      now: () => 0,
      nextFrame: () =>
        new Promise<number>((resolve) => frameResolvers.push(resolve))
    })
    await vi.waitFor(() => expect(frameResolvers).toHaveLength(1))

    pauseAgentGraphBuild()
    frameResolvers[0](16)
    await vi.waitFor(() =>
      expect(agentGraphBuildPlaybackState.value.phase).toBe('paused')
    )
    expect(move).toHaveBeenCalledTimes(1)

    resumeAgentGraphBuild()
    await vi.waitFor(() => expect(frameResolvers).toHaveLength(2))
    skipAgentGraphBuild()
    frameResolvers[1](32)
    await vi.waitFor(() =>
      expect(agentGraphBuildPlaybackState.value.phase).toBe('complete')
    )
    expect(move).toHaveBeenCalledWith(target)
    expect(move).toHaveBeenLastCalledWith(null)
    vi.runAllTimers()
  })

  it('releases a paused playback when its node is deleted', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    let resolveFrame: ((time: number) => void) | undefined
    const present = vi.fn()

    stageAgentGraphNodeBuild({
      key: 'workflow:paused-delete',
      label: 'Temporary node',
      source: { x: 0, y: 400 },
      target: { x: 400, y: 100 },
      present,
      toClient: (position) => position,
      durationMs: 1_000,
      gapMs: 0,
      now: () => 0,
      nextFrame: () =>
        new Promise<number>((resolve) => {
          resolveFrame = resolve
        })
    })
    await vi.waitFor(() => expect(resolveFrame).toBeTypeOf('function'))

    pauseAgentGraphBuild()
    resolveFrame?.(16)
    await vi.waitFor(() =>
      expect(agentGraphBuildPlaybackState.value.phase).toBe('paused')
    )
    cancelAgentGraphNodeBuild('workflow:paused-delete')

    await vi.waitFor(() =>
      expect(agentGraphBuildPlaybackState.value.phase).toBe('complete')
    )
    expect(present).toHaveBeenLastCalledWith(null)
    vi.runAllTimers()
  })
})
