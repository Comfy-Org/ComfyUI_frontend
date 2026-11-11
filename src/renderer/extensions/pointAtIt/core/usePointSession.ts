import { useEventListener, useRafFn } from '@vueuse/core'
import { onScopeDispose, reactive, shallowRef } from 'vue'

import type { AgentQuestion, StepWait, TargetAddress } from './agentReply'
import { flightPosition, isInView, rectCenter } from './geometry'
import type { Point, Rect } from './geometry'
import { markSelection, matchMark } from './markMatching'
import { MARK_KEY } from './messages'
import type { PointHost } from './pointHost'
import { idleState, reducePointState } from './pointState'
import type { GuidingState, PointEvent, PointState } from './pointState'
import { answerQuestion } from './scriptedAgent'
import { isTextEntry } from './textEntry'
import { hasSettled, observeValue, startWatch } from './valueWatch'
import type { ValueWatch } from './valueWatch'

export const REPLY_DELAYS_MS = [0, 2000, 8000] as const

export interface DemoSettings {
  replyDelayMs: number
  wrongTarget: boolean
  heldKeyEntry: boolean
  selectionEntry: boolean
}

export interface GuidanceView {
  ring: Rect | null
  pointer: Point
}

interface StepRun {
  from: Point
  flightStartedAt: number | null
  watch: ValueWatch | null
}

const POINTER_INSET = 16
const MIN_STROKE_STEP = 3

function pointerTip(target: TargetAddress, rect: Rect): Point {
  if (target.kind === 'setting')
    return {
      x: rect.x + rect.width - POINTER_INSET,
      y: rect.y + rect.height / 2
    }
  if (target.kind === 'node')
    return { x: rect.x + rect.width / 2, y: rect.y + POINTER_INSET }
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height }
}

function isMarkKey(event: KeyboardEvent): boolean {
  return event.key === MARK_KEY || event.key === MARK_KEY.toUpperCase()
}

function hasModifier(event: KeyboardEvent): boolean {
  return event.ctrlKey || event.metaKey || event.altKey || event.shiftKey
}

function swallow(event: KeyboardEvent): void {
  event.preventDefault()
  event.stopImmediatePropagation()
}

function sameView(a: GuidanceView | null, b: GuidanceView): boolean {
  return (
    a !== null &&
    a.pointer.x === b.pointer.x &&
    a.pointer.y === b.pointer.y &&
    a.ring?.x === b.ring?.x &&
    a.ring?.y === b.ring?.y &&
    a.ring?.width === b.ring?.width &&
    a.ring?.height === b.ring?.height
  )
}

/** Owns the layer's one state and every command that changes it. */
export function usePointSession(host: PointHost) {
  const state = shallowRef<PointState>(idleState)
  const view = shallowRef<GuidanceView | null>(null)
  const settings = reactive<DemoSettings>({
    replyDelayMs: 2000,
    wrongTarget: false,
    heldKeyEntry: true,
    selectionEntry: true
  })
  const pendingReplies = new Set<ReturnType<typeof setTimeout>>()
  const frames = useRafFn(() => tick(performance.now()), {
    immediate: false
  })
  let questionCount = 0
  let stepRun: StepRun | null = null
  let markKeyHeld = false

  function revealIfHidden(target: TargetAddress | null): void {
    if (!target || target.kind === 'control') return
    const reading = host.readTarget(target)
    if (!reading) return
    if (reading.rect && isInView(reading.rect, host.viewport())) return
    void host.reveal(target)
  }

  function beginStep(guiding: GuidingState): void {
    const step = guiding.steps[guiding.index]
    const wait = step.waitFor
    const from = view.value?.pointer ?? guiding.origin
    stepRun = {
      from,
      flightStartedAt: null,
      watch:
        wait?.for === 'valueChange'
          ? startWatch(host.readTarget(wait.of)?.value, performance.now())
          : null
    }
    view.value = { ring: null, pointer: from }
    revealIfHidden(step.target)
  }

  function send(event: PointEvent): void {
    const previous = state.value
    const next = reducePointState(previous, event)
    if (next === previous) return
    state.value = next
    if (next.phase !== 'guiding') {
      frames.pause()
      stepRun = null
      view.value = null
      return
    }
    frames.resume()
    if (previous.phase !== 'guiding' || previous.index !== next.index)
      beginStep(next)
  }

  function waitOutcome(
    run: StepRun,
    wait: StepWait | undefined,
    now: number
  ): 'removed' | 'settled' | 'waiting' {
    if (wait?.for !== 'valueChange' || !run.watch) return 'waiting'
    const reading = host.readTarget(wait.of)
    if (!reading) return 'removed'
    run.watch = observeValue(run.watch, reading.value, now)
    return hasSettled(run.watch, wait.direction, now) ? 'settled' : 'waiting'
  }

  function pointerAt(
    run: StepRun,
    target: TargetAddress | null,
    rect: Rect | null,
    now: number
  ): Point {
    if (!target || !rect) return run.from
    run.flightStartedAt ??= now
    return flightPosition(
      run.from,
      pointerTip(target, rect),
      now - run.flightStartedAt
    )
  }

  function tick(now: number): void {
    const guiding = state.value
    if (guiding.phase !== 'guiding' || !stepRun) return
    const step = guiding.steps[guiding.index]
    const reading = step.target ? host.readTarget(step.target) : undefined
    const outcome = waitOutcome(stepRun, step.waitFor, now)
    if (reading === null || outcome === 'removed') {
      send({ type: 'targetRemoved' })
      return
    }
    if (outcome === 'settled') {
      send({ type: 'valueChanged' })
      return
    }
    const ring = reading?.rect ?? null
    const next = { ring, pointer: pointerAt(stepRun, step.target, ring, now) }
    if (!sameView(view.value, next)) view.value = next
  }

  function readSelectionMark() {
    const selection = host.readSelection()
    if (selection.length === 0) return null
    const centre = rectCenter(host.viewport())
    return markSelection(selection, host.readNodes(), {
      ...centre,
      width: 0,
      height: 0
    })
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.isComposing) return
    const { phase } = state.value
    if (event.key === 'Escape') {
      if (phase === 'idle') return
      swallow(event)
      send({ type: 'dismissed' })
      return
    }
    if (!isMarkKey(event) || hasModifier(event)) return
    if (markKeyHeld) {
      swallow(event)
      return
    }
    if (isTextEntry(event.composedPath()[0] ?? event.target)) return
    if (phase !== 'idle') return
    if (!settings.heldKeyEntry && !settings.selectionEntry) return
    swallow(event)
    markKeyHeld = true
    send({
      type: 'keyPressed',
      at: performance.now(),
      canMark: settings.heldKeyEntry,
      canTap: settings.selectionEntry
    })
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (!isMarkKey(event)) return
    markKeyHeld = false
    if (state.value.phase !== 'armed') return
    swallow(event)
    send({
      type: 'keyReleased',
      at: performance.now(),
      selection: settings.selectionEntry ? readSelectionMark() : null
    })
  }

  function onWindowBlur(): void {
    markKeyHeld = false
    const { phase } = state.value
    if (phase === 'armed' || phase === 'marking') send({ type: 'dismissed' })
  }

  function pressPointer(point: Point): void {
    send({ type: 'pointerPressed', point })
  }

  function movePointer(point: Point): void {
    const marking = state.value
    if (marking.phase !== 'marking') return
    const last = marking.stroke[marking.stroke.length - 1]
    const moved = Math.hypot(point.x - last.x, point.y - last.y)
    if (moved >= MIN_STROKE_STEP) send({ type: 'pointerMoved', point })
  }

  function releasePointer(): void {
    const marking = state.value
    if (marking.phase !== 'marking') return
    send({
      type: 'pointerReleased',
      chips: matchMark(marking.stroke, host.readNodes())
    })
  }

  function removeChip(chipId: string): void {
    send({ type: 'chipRemoved', chipId })
  }

  function ask(text: string): void {
    const asking = state.value
    if (asking.phase !== 'asking' || !text.trim()) return
    const question: AgentQuestion = {
      questionId: `question-${++questionCount}`,
      text: text.trim(),
      marked: asking.chips.map((chip) => chip.target)
    }
    send({
      type: 'questionSent',
      questionId: question.questionId,
      text: question.text
    })
    const reply = answerQuestion(question, host.readNodes(), {
      wrongTarget: settings.wrongTarget
    })
    const timer = setTimeout(() => {
      pendingReplies.delete(timer)
      send({ type: 'replyArrived', reply })
    }, settings.replyDelayMs)
    pendingReplies.add(timer)
  }

  function applyOfferedEdit(): void {
    const guiding = state.value
    if (guiding.phase !== 'guiding') return
    const edit = guiding.steps[guiding.index].offerEdit
    if (!edit) return
    send({
      type: host.write(edit.target, edit.value) ? 'editApplied' : 'editFailed'
    })
  }

  function next(): void {
    send({ type: 'nextRequested' })
  }

  function finish(): void {
    send({ type: 'finished' })
  }

  function dismiss(): void {
    send({ type: 'dismissed' })
  }

  useEventListener(window, 'keydown', onKeyDown, { capture: true })
  useEventListener(window, 'keyup', onKeyUp, { capture: true })
  useEventListener(window, 'blur', onWindowBlur)
  const stopRunListener = host.onRunQueued(() => send({ type: 'runQueued' }))
  onScopeDispose(() => {
    stopRunListener()
    pendingReplies.forEach((timer) => clearTimeout(timer))
    pendingReplies.clear()
  })

  return {
    state,
    view,
    settings,
    pressPointer,
    movePointer,
    releasePointer,
    removeChip,
    ask,
    applyOfferedEdit,
    next,
    finish,
    dismiss
  }
}
