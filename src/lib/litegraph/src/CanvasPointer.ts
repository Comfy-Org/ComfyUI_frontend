import type { CompassCorners } from './interfaces'
import { dist2 } from './measure'
import type { CanvasPointerEvent } from './types/events'

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
  /** Maximum time in milliseconds to ignore click drift */
  static bufferTime = 150

  /** Maximum gap between pointerup and pointerdown events to be considered as a double click */
  static doubleClickTime = 300

  /** Maximum offset from click location */
  static get maxClickDrift() {
    return this.#maxClickDrift
  }

  static set maxClickDrift(value) {
    this.#maxClickDrift = value
    this.#maxClickDrift2 = value * value
  }

  static #maxClickDrift = 6
  /** {@link maxClickDrift} squared.  Used to calculate click drift without `sqrt`. */
  static #maxClickDrift2 = this.#maxClickDrift ** 2

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

  /** The element this PointerState should capture input against when dragging. */
  element: Element
  /** Pointer ID used by drag capture. */
  pointerId?: number

  /** Set to true when if the pointer moves far enough after a down event, before the corresponding up event is fired. */
  dragStarted: boolean = false

  /** The {@link eUp} from the last successful click */
  eLastDown?: CanvasPointerEvent

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

  /** The last pointermove event that was treated as a trackpad gesture. */
  lastTrackpadEvent?: WheelEvent

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
  linuxBufferTimeoutId?: number

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
    return this.#finally
  }

  set finally(value) {
    try {
      this.#finally?.()
    } finally {
      this.#finally = value
    }
  }

  #finally?: () => unknown

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
      this.#completeClick(e)
      this.reset()
      return
    }
    this.eMove = e
    this.onDrag?.(e)

    // Dragging, but no callback to run
    if (this.dragStarted) return

    const longerThanBufferTime =
      e.timeStamp - eDown.timeStamp > CanvasPointer.bufferTime
    if (longerThanBufferTime || !this.#hasSamePosition(e, eDown)) {
      this.#setDragStarted(e)
    }
  }

  /**
   * Callback for `pointerup` events.  To be used as the event handler (or called by it).
   * @param e The `pointerup` event
   */
  up(e: CanvasPointerEvent): boolean {
    if (e.button !== this.eDown?.button) return false

    this.#completeClick(e)
    const { dragStarted } = this
    this.reset()
    return !dragStarted
  }

  #completeClick(e: CanvasPointerEvent): void {
    const { eDown } = this
    if (!eDown) return

    this.eUp = e

    if (this.dragStarted) {
      // A move event already started drag
      this.onDragEnd?.(e)
    } else if (!this.#hasSamePosition(e, eDown)) {
      // Teleport without a move event (e.g. tab out, move, tab back)
      this.#setDragStarted()
      this.onDragEnd?.(e)
    } else if (this.onDoubleClick && this.#isDoubleClick()) {
      // Double-click event
      this.onDoubleClick(e)
      this.eLastDown = undefined
    } else {
      // Normal click event
      this.onClick?.(e)
      this.eLastDown = eDown
    }
  }

  /**
   * Checks if two events occurred near each other - not further apart than the maximum click drift.
   * @param a The first event to compare
   * @param b The second event to compare
   * @param tolerance2 The maximum distance (squared) before the positions are considered different
   * @returns `true` if the two events were no more than {@link maxClickDrift} apart, otherwise `false`
   */
  #hasSamePosition(
    a: PointerEvent,
    b: PointerEvent,
    tolerance2 = CanvasPointer.#maxClickDrift2
  ): boolean {
    const drift = dist2(a.clientX, a.clientY, b.clientX, b.clientY)
    return drift <= tolerance2
  }

  /**
   * Checks whether the pointer is currently past the max click drift threshold.
   * @returns `true` if the latest pointer event is past the the click drift threshold
   */
  #isDoubleClick(): boolean {
    const { eDown, eLastDown } = this
    if (!eDown || !eLastDown) return false

    // Use thrice the drift distance for double-click gap
    const tolerance2 = (3 * CanvasPointer.#maxClickDrift) ** 2
    const diff = eDown.timeStamp - eLastDown.timeStamp
    return (
      diff > 0 &&
      diff < CanvasPointer.doubleClickTime &&
      this.#hasSamePosition(eDown, eLastDown, tolerance2)
    )
  }

  #setDragStarted(eMove?: CanvasPointerEvent): void {
    this.dragStarted = true
    this.onDragStart?.(this, eMove)
    delete this.onDragStart
  }

  /**
   * Checks if the given wheel event is part of a trackpad gesture.
   * This method now uses the new device detection internally for improved accuracy.
   * @param e The wheel event to check
   * @returns `true` if the event is part of a trackpad gesture, otherwise `false`
   */
  isTrackpadGesture(e: WheelEvent): boolean {
    // Use the new device detection
    this.detectDevice(e)

    // For backward compatibility, update lastTrackpadEvent
    if (this.detectedDevice === 'trackpad') {
      this.lastTrackpadEvent = e
    } else {
      // Clear lastTrackpadEvent for mouse
      this.lastTrackpadEvent = undefined
    }

    return this.detectedDevice === 'trackpad'
  }

  /**
   * Detects whether the input device is a mouse or trackpad based on wheel event patterns.
   * Uses an efficient timestamp-based approach with at most one timer for Linux detection.
   * @param event The wheel event to analyze
   */
  detectDevice(event: WheelEvent): void {
    const now = performance.now()
    const timeSinceLastEvent = now - this.lastWheelEventTime

    // Check if we have a buffered Linux event to validate
    if (this.bufferedLinuxEvent && this.bufferedLinuxEventTime > 0) {
      const timeSinceBuffer = now - this.bufferedLinuxEventTime
      if (timeSinceBuffer <= 10 && event.deltaX === 0) {
        // Check for Linux wheel pattern (divisibility)
        if (
          this.isLinuxWheelPattern(this.bufferedLinuxEvent.deltaY, event.deltaY)
        ) {
          this.detectedDevice = 'mouse'
          this.clearLinuxBuffer()
          this.lastWheelEventTime = now
          return
        }
      }
      // Clear buffer if not matched or timeout
      if (timeSinceBuffer > 10) {
        this.clearLinuxBuffer()
      }
    }

    // Check cooldown period
    const isFirstEvent = !this.hasReceivedWheelEvent
    const cooldownExpired = timeSinceLastEvent >= CanvasPointer.trackpadMaxGap
    const inCooldown = !isFirstEvent && !cooldownExpired

    if (inCooldown) {
      // Within cooldown - don't allow switching modes
      // Exception: Linux buffering in trackpad mode
      if (this.shouldBufferLinuxEvent(event)) {
        this.bufferLinuxEvent(event, now)
      }
      // Update time to keep tracking the most recent event
      this.lastWheelEventTime = now
      return
    }

    // Perform device detection (first event or after cooldown)

    // Check for trackpad patterns
    if (this.isTrackpadPattern(event, isFirstEvent)) {
      this.detectedDevice = 'trackpad'
    }
    // Check for mouse patterns
    else if (this.isMousePattern(event)) {
      this.detectedDevice = 'mouse'
    }
    // In trackpad mode, check if we should buffer potential Linux event
    else if (
      this.detectedDevice === 'trackpad' &&
      this.shouldBufferLinuxEvent(event)
    ) {
      this.bufferLinuxEvent(event, now)
    }

    this.lastWheelEventTime = now
    this.hasReceivedWheelEvent = true
  }

  /**
   * Clears the buffered Linux wheel event and associated timer.
   */
  clearLinuxBuffer(): void {
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
   * @param isFirstEvent Whether this is the first event after loading
   */
  private isTrackpadPattern(event: WheelEvent, isFirstEvent: boolean): boolean {
    // Two-finger panning: non-zero deltaX AND deltaY
    if (event.deltaX !== 0 && event.deltaY !== 0) {
      return true
    }

    // Pinch-to-zoom: ctrlKey with small deltaY
    if (event.ctrlKey && Math.abs(event.deltaY) < 10) {
      return true
    }

    // On first event, also switch to trackpad for two-finger panning with any values
    if (isFirstEvent && (event.deltaX !== 0 || event.deltaY !== 0)) {
      // Check if it looks like two-finger panning (both axes or small values)
      if (event.deltaX !== 0 && event.deltaY !== 0) {
        return true
      }
    }

    return false
  }

  /**
   * Checks if the event matches mouse wheel input patterns.
   * @param event The wheel event to check
   * @param inCooldown Whether we're within the cooldown period
   */
  private isMousePattern(event: WheelEvent): boolean {
    const absY = Math.abs(event.deltaY)

    // Clear mouse wheel event: deltaY > 80 (strictly greater)
    // This is the primary threshold for switching from trackpad to mouse
    if (absY > 80) {
      return true
    }

    // Windows/Mac mouse: deltaY >= 60
    // Only when already in mouse mode (not for switching from trackpad)
    if (absY >= 60 && event.deltaX === 0 && this.detectedDevice === 'mouse') {
      return true
    }

    return false
  }

  /**
   * Checks if the event should be buffered as a potential Linux wheel event.
   * @param event The wheel event to check
   */
  private shouldBufferLinuxEvent(event: WheelEvent): boolean {
    const absY = Math.abs(event.deltaY)
    // Don't buffer clear mouse events (>= 60)
    // Only buffer potential Linux wheel events in the 10-59 range
    return (
      this.detectedDevice === 'trackpad' &&
      absY >= 10 &&
      absY < 60 &&
      event.deltaX === 0 &&
      Number.isInteger(event.deltaY)
    )
  }

  /**
   * Buffers a potential Linux wheel event for later confirmation.
   * @param event The event to buffer
   * @param now The current timestamp
   */
  private bufferLinuxEvent(event: WheelEvent, now: number): void {
    // Clear any existing timeout
    if (this.linuxBufferTimeoutId !== undefined) {
      clearTimeout(this.linuxBufferTimeoutId)
    }

    this.bufferedLinuxEvent = event
    this.bufferedLinuxEventTime = now

    // Set timeout to clear buffer after 10ms
    this.linuxBufferTimeoutId = setTimeout(() => {
      this.clearLinuxBuffer()
    }, 10) as unknown as number
  }

  /**
   * Checks if two deltaY values follow a Linux wheel pattern (divisibility).
   * @param deltaY1 The first deltaY value
   * @param deltaY2 The second deltaY value
   */
  private isLinuxWheelPattern(deltaY1: number, deltaY2: number): boolean {
    const abs1 = Math.abs(deltaY1)
    const abs2 = Math.abs(deltaY2)

    // Check if they're the same value
    if (abs1 === abs2) {
      return true
    }

    // Check divisibility (one is a multiple of the other)
    if (abs1 > 0 && abs2 > 0) {
      return abs1 % abs2 === 0 || abs2 % abs1 === 0
    }

    return false
  }

  /**
   * Resets the state of this {@link CanvasPointer} instance.
   *
   * The {@link finally} callback is first executed, then all callbacks and intra-click
   * state is cleared.
   */
  reset(): void {
    // The setter executes the callback before clearing it
    this.finally = undefined
    delete this.onClick
    delete this.onDoubleClick
    delete this.onDragStart
    delete this.onDrag
    delete this.onDragEnd

    this.isDown = false
    this.isDouble = false
    this.dragStarted = false
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
