import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  agentGraphBuildPlaybackState,
  cancelAgentGraphNodeBuild,
  pauseAgentGraphBuild,
  resumeAgentGraphBuild,
  skipAgentGraphBuild,
  stageAgentGraphNodeBuild
} from './agentGraphBuildPlayback'

afterEach(async () => {
  skipAgentGraphBuild()
  await vi.waitFor(() =>
    expect(['idle', 'complete']).toContain(
      agentGraphBuildPlaybackState.value.phase
    )
  )
  if (vi.isFakeTimers()) vi.runOnlyPendingTimers()
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

  it('selects a node from the library before dragging it to the canvas', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const present = vi.fn()
    const pickup = { x: 48, y: 160 }
    const target = { x: 620, y: 120 }

    stageAgentGraphNodeBuild({
      key: 'workflow:library-pick',
      label: 'KSampler',
      source: { x: 400, y: 700 },
      pickup,
      target,
      present,
      toClient: (position) => position,
      durationMs: 0,
      gapMs: 0,
      wait: async () => {}
    })

    await vi.waitFor(() =>
      expect(agentGraphBuildPlaybackState.value.phase).toBe('complete')
    )
    expect(present).toHaveBeenCalledWith(pickup)
    expect(present).toHaveBeenCalledWith(target)
    expect(present).toHaveBeenLastCalledWith(null)
    vi.runAllTimers()
  })

  it('opens the real library result before starting the node drag', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const present = vi.fn()
    const libraryButton = { x: 48, y: 160 }
    const libraryResult = { x: 180, y: 260 }
    const target = { x: 620, y: 120 }
    const selectFromLibrary = vi.fn(
      async (_signal: AbortSignal) => libraryResult
    )

    stageAgentGraphNodeBuild({
      key: 'workflow:real-library-pick',
      label: 'KSampler',
      source: { x: 400, y: 700 },
      pickup: libraryButton,
      selectFromLibrary,
      target,
      present,
      toClient: (position) => position,
      durationMs: 0,
      gapMs: 0,
      wait: async () => {}
    })

    await vi.waitFor(() =>
      expect(agentGraphBuildPlaybackState.value.phase).toBe('complete')
    )
    expect(selectFromLibrary).toHaveBeenCalledOnce()
    expect(selectFromLibrary.mock.calls[0][0]).toBeInstanceOf(AbortSignal)
    expect(present).toHaveBeenCalledWith(libraryResult)
    expect(present).toHaveBeenCalledWith(target)
    vi.runAllTimers()
  })

  it('draws a connection between output and input sockets', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const fallbackSource = { x: 200, y: 100 }
    const fallbackTarget = { x: 480, y: 240 }
    const source = { x: 240, y: 120 }
    const target = { x: 520, y: 260 }
    const resolveEndpoints = vi.fn(() => ({ source, target }))
    let resolveFrame: ((time: number) => void) | undefined

    stageAgentGraphNodeBuild({
      key: 'workflow:link-1',
      kind: 'connection',
      label: 'Model → Sampler',
      source: fallbackSource,
      target: fallbackTarget,
      resolveEndpoints,
      present: vi.fn(),
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
    expect(resolveEndpoints).toHaveBeenCalledOnce()
    expect(agentGraphBuildPlaybackState.value).toMatchObject({
      phase: 'playing',
      action: 'connecting',
      cursorX: source.x,
      cursorY: source.y,
      activeConnection: {
        startX: source.x,
        startY: source.y,
        endX: source.x,
        endY: source.y
      }
    })

    resolveFrame?.(1_000)
    await vi.waitFor(() =>
      expect(agentGraphBuildPlaybackState.value.phase).toBe('complete')
    )
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
    const nextFrame = vi.fn(() => new Promise<number>(() => {}))
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
      nextFrame
    })
    await vi.waitFor(() => expect(nextFrame).toHaveBeenCalledOnce())

    skipAgentGraphBuild()

    await vi.waitFor(() =>
      expect(agentGraphBuildPlaybackState.value.phase).toBe('complete')
    )
    expect(move).toHaveBeenCalledWith(target)
    expect(move).toHaveBeenLastCalledWith(null)
    expect(restoreConnections).toHaveBeenCalledOnce()
    vi.runAllTimers()
  })

  it('cancels an in-flight node without waiting for its next frame', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const nextFrame = vi.fn(() => new Promise<number>(() => {}))
    const present = vi.fn()
    const restoreConnections = vi.fn()

    stageAgentGraphNodeBuild({
      key: 'workflow:cancel-in-flight',
      label: 'Cancelled node',
      source: { x: 20, y: 500 },
      target: { x: 700, y: 140 },
      present,
      toClient: (position) => position,
      suspendConnections: () => restoreConnections,
      durationMs: 1_000,
      gapMs: 0,
      now: () => 0,
      nextFrame
    })
    await vi.waitFor(() => expect(nextFrame).toHaveBeenCalledOnce())

    cancelAgentGraphNodeBuild('workflow:cancel-in-flight')

    await vi.waitFor(() =>
      expect(agentGraphBuildPlaybackState.value.phase).toBe('complete')
    )
    expect(present).toHaveBeenLastCalledWith(null)
    expect(restoreConnections).toHaveBeenCalledOnce()
    vi.runAllTimers()
  })

  it('skip interrupts the gap before the next node', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    const wait = vi.fn(() => new Promise<void>(() => {}))
    const firstPresent = vi.fn()
    const secondPresent = vi.fn()
    const secondTarget = { x: 500, y: 100 }

    stageAgentGraphNodeBuild({
      key: 'workflow:gap-first',
      label: 'First node',
      source: { x: 0, y: 500 },
      target: { x: 100, y: 100 },
      present: firstPresent,
      toClient: (position) => position,
      durationMs: 0,
      gapMs: 1_000,
      wait
    })
    stageAgentGraphNodeBuild({
      key: 'workflow:gap-second',
      label: 'Second node',
      source: { x: 0, y: 500 },
      target: secondTarget,
      present: secondPresent,
      toClient: (position) => position,
      durationMs: 0,
      gapMs: 0
    })
    await vi.waitFor(() => expect(wait).toHaveBeenCalledOnce())

    skipAgentGraphBuild()

    await vi.waitFor(() =>
      expect(agentGraphBuildPlaybackState.value.phase).toBe('complete')
    )
    expect(secondPresent).toHaveBeenCalledWith(secondTarget)
    expect(secondPresent).toHaveBeenLastCalledWith(null)
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
