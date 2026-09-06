import type {
  GestureEffect,
  GestureEvent,
  GesturePoint,
  GestureState
} from './canvas/reduceGesture'
import { idleGesture, reduceGesture } from './canvas/reduceGesture'
import type { CompassCorners } from './interfaces'
import type { CanvasPointerEvent } from './types/events'

function positionOf(e: PointerEvent): GesturePoint {
  return { x: e.clientX, y: e.clientY }
}

/**
 * Allows click and drag actions to be declared ahead of time during a pointerdown event.
 *
 * By default, it retains the most recent event of each type until it is reset (on pointerup).
 * - {@link eDown}
 * - {@link eMove}
 * - {@link eUp}
 *
 * Depending on whether the user clicks or drags the pointer, only the appropriate callbacks are called:
 * - {@link onClick}
 * - {@link onDoubleClick}
 * - {@link onDragStart}
 * - {@link onDrag}
 * - {@link onDragEnd}
 * - {@link finally}
 * @see
 * - {@link LGraphCanvas.processMouseDown}
 * - {@link LGraphCanvas.processMouseMove}
 * - {@link LGraphCanvas.processMouseUp}
 */
export class CanvasPointer {
  /** Maximum gap between pointerup and pointerdown events to be considered as a double click */
  static doubleClickTime = 300

  /** Maximum offset from click location */
  static maxClickDrift = 6

  /** Assume that "wheel" events with both deltaX and deltaY less than this value are trackpad gestures. */
  static trackpadThreshold = 60

  /**
   * The minimum time between "wheel" events to allow switching between trackpad
   * and mouse modes.
   *
   * This prevents trackpad "flick" panning from registering as regular mouse wheel.
   * After a flick gesture is complete, the automatic wheel events are sent with
   * reduced frequency, but much higher deltaX and deltaY values.
   */
  static trackpadMaxGap = 500

  /** The maximum time in milliseconds to buffer a high-res wheel event. */
  static maxHighResBufferTime = 10

  /** The element this PointerState should capture input against when dragging. */
  element: Element
  /** Pointer ID used by drag capture. */
  pointerId?: number

  /** `true` once the pointer has moved far enough after a down event to be a drag, until the corresponding up event. */
  get dragStarted(): boolean {
    return this.#state.phase === 'dragging'
  }

  #state: GestureState = idleGesture

  /** Used downstream for touch event support. */
  isDouble: boolean = false
  /** Used downstream for touch event support. */
  isDown: boolean = false

  /** The resize handle currently being hovered or dragged */
  resizeDirection?: CompassCorners

  /**
   * If `true`, {@link eDown}, {@link eMove}, and {@link eUp} will be set to
   * `undefined` when {@link reset} is called.
   *
   * Default: `true`
   */
  clearEventsOnReset: boolean = true

  /** The last pointerdown event for the primary button */
  eDown?: CanvasPointerEvent
  /** The last pointermove event for the primary button */
  eMove?: CanvasPointerEvent
  /** The last pointerup event for the primary button */
  eUp?: CanvasPointerEvent

  /** Currently detected input device type */
  detectedDevice: 'mouse' | 'trackpad' = 'mouse'

  /** Timestamp of last wheel event for cooldown tracking */
  lastWheelEventTime: number = 0

  /** Flag to track if we've received the first wheel event */
  hasReceivedWheelEvent: boolean = false

  /** Buffered Linux wheel event awaiting confirmation */
  bufferedLinuxEvent?: WheelEvent

  /** Timestamp when Linux event was buffered */
  bufferedLinuxEventTime: number = 0

  /** Timer ID for Linux buffer clearing */
  linuxBufferTimeoutId?: ReturnType<typeof setTimeout>

  /**
   * If set, as soon as the mouse moves outside the click drift threshold, this action is run once.
   * @param pointer [DEPRECATED] This parameter will be removed in a future release.
   * @param eMove The pointermove event of this ongoing drag action.
   *
   * It is possible for no `pointermove` events to occur, but still be far from
   * the original `pointerdown` event. In this case, {@link eMove} will be null, and
   * {@link onDragEnd} will be called immediately after {@link onDragStart}.
   */
  onDragStart?(pointer: this, eMove?: CanvasPointerEvent): unknown

  /**
   * Called on pointermove whilst dragging.
   * @param eMove The pointermove event of this ongoing drag action
   */
  onDrag?(eMove: CanvasPointerEvent): unknown

  /**
   * Called on pointerup after dragging (i.e. not called if clicked).
   * @param upEvent The pointerup or pointermove event that triggered this callback
   */
  onDragEnd?(upEvent: CanvasPointerEvent): unknown

  /**
   * Callback that will be run once, the next time a pointerup event appears to be a normal click.
   * @param upEvent The pointerup or pointermove event that triggered this callback
   */
  onClick?(upEvent: CanvasPointerEvent): unknown

  /**
   * Callback that will be run once, the next time a pointerup event appears to be a normal click.
   * @param upEvent The pointerup or pointermove event that triggered this callback
   */
  onDoubleClick?(upEvent: CanvasPointerEvent): unknown

  /**
   * Run-once callback, called at the end of any click or drag, whether or not it was successful in any way.
   *
   * The setter of this callback will call the existing value before replacing it.
   * Therefore, simply setting this value twice will execute the first callback.
   */
  get finally() {
    return this._finally
  }

  set finally(value) {
    try {
      this._finally?.()
    } finally {
      this._finally = value
    }
  }

  private _finally?: () => unknown

  constructor(element: Element) {
    this.element = element
  }

  /**
   * Callback for `pointerdown` events.  To be used as the event handler (or called by it).
   * @param e The `pointerdown` event
   */
  down(e: CanvasPointerEvent): void {
    this.reset()
    this.eDown = e
    this.pointerId = e.pointerId
    this.element.setPointerCapture(e.pointerId)
    this.#dispatch(
      { type: 'down', position: positionOf(e), timeStamp: e.timeStamp },
      e
    )
  }

  /**
   * Callback for `pointermove` events.  To be used as the event handler (or called by it).
   * @param e The `pointermove` event
   */
  move(e: CanvasPointerEvent): void {
    const { eDown } = this
    if (!eDown) return

    // No buttons down, but eDown exists - clean up & leave
    if (!e.buttons) {
      this.reset()
      return
    }

    // Primary button released - treat as pointerup.
    if (!(e.buttons & eDown.buttons)) {
      this.#dispatch({ type: 'up', position: positionOf(e) }, e)
      this.reset()
      return
    }
    this.eMove = e
    this.#dispatch({ type: 'move', position: positionOf(e) }, e)
  }

  /**
   * Callback for `pointerup` events.  To be used as the event handler (or called by it).
   * @param e The `pointerup` event
   * @returns `true` if the gesture ended as a click rather than a drag
   */
  up(e: CanvasPointerEvent): boolean {
    if (e.button !== this.eDown?.button) return false

    this.eUp = e
    const effects = this.#dispatch({ type: 'up', position: positionOf(e) }, e)
    this.reset()
    return effects.includes('click') || effects.includes('doubleClick')
  }

  #dispatch(event: GestureEvent, e: CanvasPointerEvent): GestureEffect[] {
    const { state, effects } = reduceGesture(this.#state, event, {
      clickDrift: CanvasPointer.maxClickDrift,
      doubleClickTime: CanvasPointer.doubleClickTime
    })
    this.#state = state
    const eMove = event.type === 'move' ? e : undefined
    for (const effect of effects) this.#run(effect, e, eMove)
    return effects
  }

  #run(
    effect: GestureEffect,
    e: CanvasPointerEvent,
    eMove: CanvasPointerEvent | undefined
  ): void {
    switch (effect) {
      case 'click':
        this.onClick?.(e)
        return
      case 'doubleClick':
        if (this.onDoubleClick) this.onDoubleClick(e)
        else this.onClick?.(e)
        return
      case 'startDrag':
        this.onDragStart?.(this, eMove)
        delete this.onDragStart
        return
      case 'moveDrag':
        this.onDrag?.(e)
        return
      case 'endDrag':
        this.onDragEnd?.(e)
        return
      case 'cancelDrag':
        return
    }
  }

  /**
   * Checks if the given wheel event is part of a trackpad gesture.
   * This method now uses the new device detection internally for improved accuracy.
   * @param e The wheel event to check
   * @returns `true` if the event is part of a trackpad gesture, otherwise `false`
   */
  isTrackpadGesture(e: WheelEvent): boolean {
    // Use the new device detection
    const now = performance.now()
    const timeSinceLastEvent = Math.max(0, now - this.lastWheelEventTime)
    this.lastWheelEventTime = now

    if (this._isHighResWheelEvent(e, now)) {
      this.detectedDevice = 'mouse'
    } else if (this._isWithinCooldown(timeSinceLastEvent)) {
      if (this._shouldBufferLinuxEvent(e)) {
        this._bufferLinuxEvent(e, now)
      }
    } else {
      this._updateDeviceMode(e, now)
      this.hasReceivedWheelEvent = true
    }

    return this.detectedDevice === 'trackpad'
  }

  /**
   * Validates buffered high res wheel events and switches to mouse mode if pattern matches.
   * @returns `true` if switched to mouse mode
   */
  private _isHighResWheelEvent(event: WheelEvent, now: number): boolean {
    if (!this.bufferedLinuxEvent || this.bufferedLinuxEventTime <= 0) {
      return false
    }

    const timeSinceBuffer = now - this.bufferedLinuxEventTime

    if (timeSinceBuffer > CanvasPointer.maxHighResBufferTime) {
      this._clearLinuxBuffer()
      return false
    }

    if (
      event.deltaX === 0 &&
      this._isLinuxWheelPattern(this.bufferedLinuxEvent.deltaY, event.deltaY)
    ) {
      this._clearLinuxBuffer()
      return true
    }

    return false
  }

  /**
   * Checks if we're within the cooldown period where mode switching is disabled.
   */
  private _isWithinCooldown(timeSinceLastEvent: number): boolean {
    const isFirstEvent = !this.hasReceivedWheelEvent
    const cooldownExpired = timeSinceLastEvent >= CanvasPointer.trackpadMaxGap
    return !isFirstEvent && !cooldownExpired
  }

  /**
   * Updates the device mode based on event patterns.
   */
  private _updateDeviceMode(event: WheelEvent, now: number): void {
    if (this._isTrackpadPattern(event)) {
      this.detectedDevice = 'trackpad'
    } else if (this._isMousePattern(event)) {
      this.detectedDevice = 'mouse'
    } else if (
      this.detectedDevice === 'trackpad' &&
      this._shouldBufferLinuxEvent(event)
    ) {
      this._bufferLinuxEvent(event, now)
    }
  }

  /**
   * Clears the buffered Linux wheel event and associated timer.
   */
  private _clearLinuxBuffer(): void {
    this.bufferedLinuxEvent = undefined
    this.bufferedLinuxEventTime = 0
    if (this.linuxBufferTimeoutId !== undefined) {
      clearTimeout(this.linuxBufferTimeoutId)
      this.linuxBufferTimeoutId = undefined
    }
  }

  /**
   * Checks if the event matches trackpad input patterns.
   * @param event The wheel event to check
   */
  private _isTrackpadPattern(event: WheelEvent): boolean {
    // Two-finger panning: non-zero deltaX AND deltaY
    if (event.deltaX !== 0 && event.deltaY !== 0) return true

    // Pinch-to-zoom: ctrlKey with small deltaY
    if (event.ctrlKey && Math.abs(event.deltaY) < 10) return true

    return false
  }

  /**
   * Checks if the event matches mouse wheel input patterns.
   * @param event The wheel event to check
   */
  private _isMousePattern(event: WheelEvent): boolean {
    const absoluteDeltaY = Math.abs(event.deltaY)

    // Primary threshold for switching from trackpad to mouse
    if (absoluteDeltaY > 80) return true

    // Secondary threshold when already in mouse mode
    return (
      absoluteDeltaY >= 60 &&
      event.deltaX === 0 &&
      this.detectedDevice === 'mouse'
    )
  }

  /**
   * Checks if the event should be buffered as a potential Linux wheel event.
   * @param event The wheel event to check
   */
  private _shouldBufferLinuxEvent(event: WheelEvent): boolean {
    const absoluteDeltaY = Math.abs(event.deltaY)
    const isInLinuxRange = absoluteDeltaY >= 10 && absoluteDeltaY < 60
    const isVerticalOnly = event.deltaX === 0
    const hasIntegerDelta = Number.isInteger(event.deltaY)

    return (
      this.detectedDevice === 'trackpad' &&
      isInLinuxRange &&
      isVerticalOnly &&
      hasIntegerDelta
    )
  }

  /**
   * Buffers a potential Linux wheel event for later confirmation.
   * @param event The event to buffer
   * @param now The current timestamp
   */
  private _bufferLinuxEvent(event: WheelEvent, now: number): void {
    if (this.linuxBufferTimeoutId !== undefined) {
      clearTimeout(this.linuxBufferTimeoutId)
    }

    this.bufferedLinuxEvent = event
    this.bufferedLinuxEventTime = now

    // Set timeout to clear buffer after 10ms
    this.linuxBufferTimeoutId = setTimeout(() => {
      this._clearLinuxBuffer()
    }, CanvasPointer.maxHighResBufferTime)
  }

  /**
   * Checks if two deltaY values follow a Linux wheel pattern (divisibility).
   * @param deltaY1 The first deltaY value
   * @param deltaY2 The second deltaY value
   */
  private _isLinuxWheelPattern(deltaY1: number, deltaY2: number): boolean {
    const absolute1 = Math.abs(deltaY1)
    const absolute2 = Math.abs(deltaY2)

    if (absolute1 === 0 || absolute2 === 0) return false
    if (absolute1 === absolute2) return true

    // Check if one value is a multiple of the other
    return absolute1 % absolute2 === 0 || absolute2 % absolute1 === 0
  }

  /**
   * Resets the state of this {@link CanvasPointer} instance.
   *
   * The {@link finally} callback is first executed, then all callbacks and intra-click
   * state is cleared.
   */
  reset(): void {
    if (this.eDown) this.#dispatch({ type: 'cancel' }, this.eDown)

    // The setter executes the callback before clearing it
    this.finally = undefined
    delete this.onClick
    delete this.onDoubleClick
    delete this.onDragStart
    delete this.onDrag
    delete this.onDragEnd

    this.isDown = false
    this.isDouble = false
    this.resizeDirection = undefined

    if (this.clearEventsOnReset) {
      this.eDown = undefined
      this.eMove = undefined
      this.eUp = undefined
    }

    const { element, pointerId } = this
    this.pointerId = undefined
    if (typeof pointerId === 'number' && element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId)
    }
  }
}
