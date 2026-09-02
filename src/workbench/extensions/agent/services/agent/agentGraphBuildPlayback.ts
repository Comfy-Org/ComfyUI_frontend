import { readonly, shallowRef } from 'vue'

import {
  initialAgentGraphBuildPlaybackState,
  reduceAgentGraphBuildPlayback
} from './agentGraphBuildPlaybackState'
import type { AgentGraphBuildPlaybackEvent } from './agentGraphBuildPlaybackState'

export interface AgentGraphBuildPoint {
  x: number
  y: number
}

interface AgentGraphBuildRequest {
  key: string
  label: string
  kind?: 'node' | 'connection'
  source: AgentGraphBuildPoint
  pickup?: AgentGraphBuildPoint
  selectFromLibrary?: (
    signal: AbortSignal
  ) => Promise<AgentGraphBuildPoint | null>
  target: AgentGraphBuildPoint
  resolveEndpoints?: () => {
    source: AgentGraphBuildPoint
    target: AgentGraphBuildPoint
  } | null
  isPresentable?: () => boolean
  prepare?: () => void
  present(position: AgentGraphBuildPoint | null): void
  toClient(position: AgentGraphBuildPoint): AgentGraphBuildPoint
  suspendConnections?: () => () => void
  durationMs?: number
  gapMs?: number
  now?: () => number
  nextFrame?: () => Promise<number>
  wait?: (durationMs: number) => Promise<void>
}

interface QueuedBuild extends AgentGraphBuildRequest {
  cancelled: boolean
  abortController: AbortController
}

const state = shallowRef(initialAgentGraphBuildPlaybackState)

export const agentGraphBuildPlaybackState = readonly(state)

const queue: QueuedBuild[] = []
let active: QueuedBuild | null = null
let draining = false
let drainScheduled = false
let skipRequested = false
let resume: (() => void) | null = null
let interruptWait: (() => void) | null = null
let completionTimer: ReturnType<typeof setTimeout> | undefined
let restoreConnections: (() => void) | undefined

const interrupted = Symbol('agent-graph-build-interrupted')

const defaultNextFrame = () =>
  new Promise<number>((resolve) => requestAnimationFrame(resolve))
const defaultWait = (durationMs: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, durationMs))

function dispatch(event: AgentGraphBuildPlaybackEvent): void {
  state.value = reduceAgentGraphBuildPlayback(state.value, event)
}

function prefersReducedMotion(): boolean {
  return (
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  )
}

function updateCursor(item: QueuedBuild, position: AgentGraphBuildPoint): void {
  const client = item.toClient(position)
  dispatch({ type: 'cursorMoved', x: client.x, y: client.y })
}

function present(item: QueuedBuild, position: AgentGraphBuildPoint): void {
  if (item.cancelled || item.isPresentable?.() === false) return
  item.present(position)
  updateCursor(item, position)
}

function actionFor(item: QueuedBuild) {
  if (item.kind === 'connection') return 'connecting' as const
  return item.pickup ? ('selecting' as const) : ('dragging' as const)
}

function easeInOutCubic(progress: number): number {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2
}

async function waitUntilResumed(): Promise<void> {
  if (state.value.phase !== 'paused' || skipRequested) return
  await new Promise<void>((resolve) => {
    resume = resolve
  })
  resume = null
}

function wake(): void {
  resume?.()
  resume = null
}

async function waitForInterrupt<T>(pending: Promise<T>) {
  let resolveInterrupt: (() => void) | undefined
  const interrupt = new Promise<typeof interrupted>((resolve) => {
    resolveInterrupt = () => resolve(interrupted)
    interruptWait = resolveInterrupt
  })

  try {
    return await Promise.race([pending, interrupt])
  } finally {
    if (interruptWait === resolveInterrupt) interruptWait = null
  }
}

function interruptActiveWait(): void {
  interruptWait?.()
  interruptWait = null
}

async function animateSegment(
  item: QueuedBuild,
  source: AgentGraphBuildPoint,
  target: AgentGraphBuildPoint,
  durationMs: number,
  update: (position: AgentGraphBuildPoint) => void
): Promise<void> {
  const now = item.now ?? (() => performance.now())
  const nextFrame = item.nextFrame ?? defaultNextFrame
  update(source)
  if (durationMs === 0 || item.cancelled) {
    update(target)
    return
  }

  let previousFrameTime = now()
  let elapsed = 0
  while (
    elapsed < durationMs &&
    !skipRequested &&
    !item.cancelled &&
    item.isPresentable?.() !== false
  ) {
    if (state.value.phase === 'paused') {
      await waitUntilResumed()
      previousFrameTime = now()
    }
    if (skipRequested || item.cancelled) break
    const frameTime = await waitForInterrupt(nextFrame())
    if (frameTime === interrupted) break
    // Pause can arrive while a requested frame is in flight. Do not advance
    // the node until playback resumes, and exclude that wall time below.
    if (state.value.phase === 'paused') continue
    if (skipRequested || item.cancelled) break
    elapsed += Math.max(0, frameTime - previousFrameTime)
    previousFrameTime = frameTime
    const progress = easeInOutCubic(Math.min(1, elapsed / durationMs))
    update({
      x: source.x + (target.x - source.x) * progress,
      y: source.y + (target.y - source.y) * progress
    })
  }
  update(target)
}

async function animate(item: QueuedBuild): Promise<void> {
  const durationMs = Math.max(0, item.durationMs ?? 520)

  if (item.kind === 'connection') {
    const endpoints = item.resolveEndpoints?.() ?? {
      source: item.source,
      target: item.target
    }
    dispatch({ type: 'actionChanged', action: 'connecting' })
    updateCursor(item, endpoints.source)
    const start = item.toClient(endpoints.source)
    dispatch({ type: 'connectionStarted', x: start.x, y: start.y })
    await animateSegment(
      item,
      endpoints.source,
      endpoints.target,
      durationMs,
      (position) => updateCursor(item, position)
    )
    dispatch({ type: 'connectionCompleted' })
    return
  }

  if (item.pickup) {
    dispatch({ type: 'actionChanged', action: 'selecting' })
    let pickup = item.pickup
    await animateSegment(
      item,
      item.source,
      pickup,
      Math.min(360, durationMs),
      (position) => updateCursor(item, position)
    )
    if (!skipRequested && !item.cancelled)
      await waitForInterrupt((item.wait ?? defaultWait)(240))
    if (!skipRequested && !item.cancelled && item.selectFromLibrary) {
      const selected = await waitForInterrupt(
        item.selectFromLibrary(item.abortController.signal)
      )
      if (selected !== interrupted && selected) {
        await animateSegment(
          item,
          pickup,
          selected,
          Math.min(320, durationMs),
          (position) => updateCursor(item, position)
        )
        pickup = selected
        if (!skipRequested && !item.cancelled)
          await waitForInterrupt((item.wait ?? defaultWait)(180))
      }
    }
    if (skipRequested || item.cancelled) return
    dispatch({ type: 'actionChanged', action: 'dragging' })
    await animateSegment(item, pickup, item.target, durationMs, (position) =>
      present(item, position)
    )
    return
  }

  dispatch({ type: 'actionChanged', action: 'dragging' })
  await animateSegment(item, item.source, item.target, durationMs, (position) =>
    present(item, position)
  )
}

function finishPlayback(): void {
  dispatch({ type: 'completed' })
  completionTimer = setTimeout(() => {
    if (!draining && queue.length === 0) dispatch({ type: 'reset' })
  }, 1_200)
}

async function drainQueue(): Promise<void> {
  if (draining) return
  draining = true
  try {
    while (queue.length > 0 && !skipRequested) {
      await waitUntilResumed()
      if (skipRequested) break
      const item = queue.shift()
      if (!item || item.cancelled) continue
      if (item.isPresentable?.() === false) {
        item.present(null)
        continue
      }
      active = item
      restoreConnections ??= item.suspendConnections?.()
      dispatch({
        type: 'started',
        nodeLabel: item.label,
        action: actionFor(item)
      })
      try {
        await animate(item)
      } finally {
        present(item, item.target)
        item.present(null)
      }
      const gapMs = Math.max(0, item.gapMs ?? 80)
      if (gapMs > 0 && queue.length > 0 && !skipRequested) {
        await waitForInterrupt((item.wait ?? defaultWait)(gapMs))
      }
      active = null
    }
  } finally {
    if (skipRequested) {
      if (active) {
        present(active, active.target)
        active.present(null)
      }
      for (const item of queue.splice(0)) {
        present(item, item.target)
        item.present(null)
      }
    }
    active = null
    restoreConnections?.()
    restoreConnections = undefined
    skipRequested = false
    draining = false
    finishPlayback()
  }
}

function scheduleDrain(): void {
  if (draining || drainScheduled) return
  drainScheduled = true
  queueMicrotask(() => {
    drainScheduled = false
    void drainQueue()
  })
}

export function stageAgentGraphNodeBuild(
  request: AgentGraphBuildRequest
): void {
  if (request.isPresentable?.() === false) {
    request.present(null)
    return
  }
  if (prefersReducedMotion()) {
    request.present(null)
    return
  }
  if (completionTimer !== undefined) {
    clearTimeout(completionTimer)
    completionTimer = undefined
  }
  queue.push({
    ...request,
    cancelled: false,
    abortController: new AbortController()
  })
  const item = queue.at(-1)
  if (item?.prepare)
    queueMicrotask(() => {
      if (!item.cancelled && item.isPresentable?.() !== false) item.prepare?.()
    })
  dispatch({ type: 'staged' })
  scheduleDrain()
}

export function cancelAgentGraphNodeBuild(key: string): void {
  if (active?.key === key) {
    active.cancelled = true
    active.abortController.abort()
    interruptActiveWait()
    wake()
  }
  for (const item of queue) {
    if (item.key === key) {
      item.cancelled = true
      item.abortController.abort()
      item.present(null)
    }
  }
}

export function pauseAgentGraphBuild(): void {
  if (!draining || state.value.phase !== 'playing' || skipRequested) return
  dispatch({ type: 'paused' })
}

export function resumeAgentGraphBuild(): void {
  if (state.value.phase !== 'paused' || skipRequested) return
  dispatch({ type: 'resumed' })
  wake()
}

export function skipAgentGraphBuild(): void {
  if (!draining && queue.length === 0) return
  skipRequested = true
  active?.abortController.abort()
  dispatch({ type: 'resumed' })
  interruptActiveWait()
  wake()
}
