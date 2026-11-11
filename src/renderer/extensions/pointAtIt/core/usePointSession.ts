import { useEventListener, useRafFn } from '@vueuse/core'
import { onScopeDispose, reactive, shallowRef } from 'vue'

import type { AgentRequest, AnnotationNote } from './agentReply'
import { reduceAnnotations } from './annotationList'
import type { Annotation, AnnotationEvent } from './annotationList'
import { flightPosition, isInView, rectCenter, unionRects } from './geometry'
import type { Point, Rect } from './geometry'
import { draftForSelection, matchMark, targetAtPoint } from './markMatching'
import type { PickedTarget } from './markMatching'
import { MARK_KEY } from './messages'
import type { HostNode, PointHost } from './pointHost'
import { idleState, reducePointState } from './pointState'
import type { Draft, GuidingState, PointEvent, PointState } from './pointState'
import { checkReply } from './replyValidation'
import type { StepWait } from './replyValidation'
import { answerRequest } from './scriptedAgent'
import type { GraphAddress, TargetAddress } from './targetAddress'
import { isTextEntry } from './textEntry'
import { hasSettled, observeValue, startWatch } from './valueWatch'
import type { ValueWatch } from './valueWatch'

export const REPLY_DELAYS_MS = [0, 2000, 8000] as const

interface DemoSettings {
  replyDelayMs: number
  wrongTarget: boolean
  heldKeyEntry: boolean
}

interface SessionOptions {
  /** The hidden hold-and-drag entry; off unless switched on outside the interface. */
  strokeEntry?: boolean
}

export interface GuidanceView {
  ring: Rect | null
  pointer: Point
}

/** Where a comment's pin is drawn; `rect` is null when its target is not drawn. */
export interface PinView {
  id: string
  number: number
  rect: Rect | null
  missing: boolean
}

interface StepRun {
  from: Point
  flightStartedAt: number | null
  watch: ValueWatch | null
}

const POINTER_INSET = 16
const MIN_STROKE_STEP = 3
const SCENE_MAX_AGE_MS = 500

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

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function noteOf(annotation: Annotation): AnnotationNote {
  return {
    id: annotation.id,
    label: annotation.label,
    comment: annotation.comment,
    targets: annotation.targets
  }
}

/** Owns the layer's states and every command that changes them. */
export function usePointSession(host: PointHost, options: SessionOptions = {}) {
  const state = shallowRef<PointState>(idleState)
  const annotations = shallowRef<readonly Annotation[]>([])
  const view = shallowRef<GuidanceView | null>(null)
  const pins = shallowRef<PinView[]>([])
  const hover = shallowRef<PickedTarget | null>(null)
  const draftAnchor = shallowRef<Rect | null>(null)
  const settings = reactive<DemoSettings>({
    replyDelayMs: 2000,
    wrongTarget: false,
    heldKeyEntry: options.strokeEntry ?? false
  })
  const frames = useRafFn(() => tick(performance.now()), { immediate: false })
  const pendingReplies = new Set<ReturnType<typeof setTimeout>>()
  let idCount = 0
  let stepRun: StepRun | null = null
  let markKeyHeld = false
  let disposed = false
  let askedRequest: AgentRequest | null = null
  let pointer: Point | null = null
  let scene: HostNode[] = []
  let sceneAt = Number.NEGATIVE_INFINITY

  function nextId(prefix: string): string {
    idCount += 1
    return `${prefix}-${idCount}`
  }

  function rectOf(targets: readonly GraphAddress[]): Rect | null {
    return unionRects(
      targets.flatMap((target) => host.readTarget(target)?.rect ?? [])
    )
  }

  function pinPoint(annotationId: string | null): Point | null {
    const rect = pins.value.find((pin) => pin.id === annotationId)?.rect
    return rect ? { x: rect.x, y: rect.y } : null
  }

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
    const from =
      view.value?.pointer ?? pinPoint(step.annotationId) ?? guiding.origin
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

  function syncFrames(): void {
    const { phase } = state.value
    const needed =
      phase === 'guiding' ||
      phase === 'annotating' ||
      annotations.value.length > 0
    if (needed) frames.resume()
    else frames.pause()
  }

  function send(event: PointEvent): void {
    if (disposed) return
    const previous = state.value
    const next = reducePointState(previous, event)
    if (next === previous) return
    state.value = next
    if (next.phase === 'annotating') {
      refreshAnnotating(performance.now())
    } else {
      hover.value = null
      draftAnchor.value = null
    }
    if (next.phase !== 'guiding') {
      stepRun = null
      view.value = null
    } else if (previous.phase !== 'guiding' || previous.index !== next.index) {
      beginStep(next)
    }
    syncFrames()
  }

  function change(event: AnnotationEvent): void {
    annotations.value = reduceAnnotations(annotations.value, event)
    refreshPins()
    syncFrames()
  }

  function waitOutcome(
    run: StepRun,
    wait: StepWait | null,
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

  function tickGuidance(now: number): void {
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
    if (!sameJson(view.value, next)) view.value = next
  }

  function refreshPins(): void {
    const next = annotations.value.map((annotation, index) => ({
      id: annotation.id,
      number: index + 1,
      rect: rectOf(annotation.targets),
      missing: annotation.targets.every(
        (target) => host.readTarget(target) === null
      )
    }))
    if (!sameJson(pins.value, next)) pins.value = next
  }

  function freshScene(now: number): HostNode[] {
    if (now - sceneAt > SCENE_MAX_AGE_MS) {
      scene = host.readNodes()
      sceneAt = now
    }
    return scene
  }

  function refreshAnnotating(now: number): void {
    const annotating = state.value
    if (annotating.phase !== 'annotating') return
    const anchor = annotating.draft ? rectOf(annotating.draft.targets) : null
    if (!sameJson(draftAnchor.value, anchor)) draftAnchor.value = anchor
    const picked =
      annotating.draft || !pointer
        ? null
        : targetAtPoint(pointer, freshScene(now))
    if (!sameJson(hover.value, picked)) hover.value = picked
  }

  function tick(now: number): void {
    refreshPins()
    refreshAnnotating(now)
    tickGuidance(now)
  }

  function readSelectionDraft(): Draft | null {
    const selection = host.readSelection()
    return selection.length > 0
      ? draftForSelection(selection, host.readNodes())
      : null
  }

  function toggleAnnotate(): void {
    const entering = state.value.phase !== 'annotating'
    pointer = null
    sceneAt = Number.NEGATIVE_INFINITY
    send({
      type: 'annotateToggled',
      selection: entering ? readSelectionDraft() : null
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
    const startsStroke = phase === 'idle' && settings.heldKeyEntry
    const toggles =
      phase === 'idle' ||
      phase === 'annotating' ||
      phase === 'failed' ||
      phase === 'guiding'
    if (!startsStroke && !toggles) return
    swallow(event)
    markKeyHeld = true
    if (startsStroke) send({ type: 'keyPressed', at: performance.now() })
    else toggleAnnotate()
  }

  function onKeyUp(event: KeyboardEvent): void {
    if (!isMarkKey(event)) return
    markKeyHeld = false
    if (state.value.phase !== 'armed') return
    swallow(event)
    send({
      type: 'keyReleased',
      at: performance.now(),
      selection: readSelectionDraft()
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
    pointer = point
    const marking = state.value
    if (marking.phase !== 'marking') return
    const last = marking.stroke[marking.stroke.length - 1]
    const moved = Math.hypot(point.x - last.x, point.y - last.y)
    if (moved >= MIN_STROKE_STEP) send({ type: 'pointerMoved', point })
  }

  function leavePointer(): void {
    pointer = null
  }

  function releasePointer(): void {
    const marking = state.value
    if (marking.phase !== 'marking') return
    send({
      type: 'pointerReleased',
      chips: matchMark(marking.stroke, host.readNodes())
    })
  }

  function pickAt(point: Point): void {
    const annotating = state.value
    if (annotating.phase !== 'annotating' || annotating.draft) return
    pointer = point
    const picked = targetAtPoint(point, host.readNodes())
    if (!picked) return
    send({
      type: 'draftOpened',
      draft: {
        annotationId: null,
        targets: [picked.address],
        label: picked.label,
        comment: ''
      }
    })
  }

  function passWheel(event: WheelEvent): void {
    host.forwardWheel(event)
    sceneAt = Number.NEGATIVE_INFINITY
  }

  function openPin(annotationId: string): void {
    const annotation = annotations.value.find(
      (candidate) => candidate.id === annotationId
    )
    if (!annotation) return
    send({
      type: 'draftOpened',
      draft: {
        annotationId,
        targets: annotation.targets,
        label: annotation.label,
        comment: annotation.comment
      }
    })
  }

  function saveDraft(comment: string): void {
    const annotating = state.value
    if (annotating.phase !== 'annotating' || !annotating.draft) return
    if (!comment.trim()) return
    const { annotationId, targets, label } = annotating.draft
    change({
      type: 'saved',
      id: annotationId ?? nextId('comment'),
      targets,
      label,
      comment
    })
    send({ type: 'draftClosed' })
  }

  function deleteDraft(): void {
    const annotating = state.value
    if (annotating.phase !== 'annotating' || !annotating.draft) return
    const { annotationId } = annotating.draft
    if (annotationId) change({ type: 'removed', id: annotationId })
    send({ type: 'draftClosed' })
  }

  function clearAnnotations(): void {
    const { phase } = state.value
    if (phase === 'waiting' || phase === 'guiding') return
    change({ type: 'cleared' })
  }

  function deliver(request: AgentRequest, reply: unknown): void {
    const { requestId } = request
    const steps = checkReply(reply, request, host.readNodes())
    if (steps) send({ type: 'replyArrived', requestId, steps })
    else
      send({ type: 'requestFailed', requestId, failure: { kind: 'malformed' } })
  }

  function run(request: AgentRequest): void {
    const reply = answerRequest(request, host.readNodes(), {
      wrongTarget: settings.wrongTarget
    })
    const timer = setTimeout(() => {
      pendingReplies.delete(timer)
      deliver(request, reply)
    }, settings.replyDelayMs)
    pendingReplies.add(timer)
  }

  function sendBatch(): void {
    const { phase } = state.value
    const canSend =
      phase === 'idle' || phase === 'annotating' || phase === 'failed'
    if (!canSend || annotations.value.length === 0) return
    const request: AgentRequest = {
      requestId: nextId('request'),
      annotations: annotations.value.map(noteOf)
    }
    askedRequest = null
    send({
      type: 'batchSent',
      requestId: request.requestId,
      at: Date.now(),
      origin: rectCenter(host.viewport())
    })
    run(request)
  }

  function ask(text: string): void {
    const asking = state.value
    if (asking.phase !== 'asking' || !text.trim()) return
    const request: AgentRequest = {
      requestId: nextId('request'),
      annotations: [
        {
          id: 'question',
          label: asking.chips.map((chip) => chip.label).join(', '),
          comment: text.trim(),
          targets: asking.chips.flatMap((chip) =>
            chip.target.kind === 'control' ? [] : [chip.target]
          )
        }
      ]
    }
    askedRequest = request
    send({
      type: 'questionSent',
      requestId: request.requestId,
      text,
      at: Date.now()
    })
    run(request)
  }

  function retry(): void {
    const failed = state.value
    if (failed.phase !== 'failed') return
    if (!failed.asked || !askedRequest) {
      sendBatch()
      return
    }
    const request = { ...askedRequest, requestId: nextId('request') }
    send({
      type: 'batchSent',
      requestId: request.requestId,
      at: Date.now(),
      origin: failed.origin
    })
    run(request)
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

  function removeChip(chipId: string): void {
    send({ type: 'chipRemoved', chipId })
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
    disposed = true
    stopRunListener()
    pendingReplies.forEach((timer) => clearTimeout(timer))
    pendingReplies.clear()
  })

  return {
    state,
    annotations,
    view,
    pins,
    hover,
    draftAnchor,
    settings,
    toggleAnnotate,
    pressPointer,
    movePointer,
    leavePointer,
    releasePointer,
    pickAt,
    passWheel,
    openPin,
    saveDraft,
    deleteDraft,
    clearAnnotations,
    sendBatch,
    ask,
    retry,
    removeChip,
    applyOfferedEdit,
    next,
    finish,
    dismiss
  }
}
