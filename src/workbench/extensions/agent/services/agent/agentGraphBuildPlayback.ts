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
  source: AgentGraphBuildPoint
  target: AgentGraphBuildPoint
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

async function animate(item: QueuedBuild): Promise<void> {
  const durationMs = Math.max(0, item.durationMs ?? 460)
  const now = item.now ?? (() => performance.now())
  const nextFrame = item.nextFrame ?? defaultNextFrame
  present(item, item.source)
  if (durationMs === 0 || item.cancelled) {
    present(item, item.target)
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
    present(item, {
      x: item.source.x + (item.target.x - item.source.x) * progress,
      y: item.source.y + (item.target.y - item.source.y) * progress
    })
  }
  present(item, item.target)
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
      dispatch({ type: 'started', nodeLabel: item.label })
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
  queue.push({ ...request, cancelled: false })
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
    interruptActiveWait()
    wake()
  }
  for (const item of queue) {
    if (item.key === key) {
      item.cancelled = true
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
  dispatch({ type: 'resumed' })
  interruptActiveWait()
  wake()
}
