import type { FloatingRenderLink } from "@/canvas/FloatingRenderLink"
import type { MovingInputLink } from "@/canvas/MovingInputLink"
import type { MovingOutputLink } from "@/canvas/MovingOutputLink"
import type { RenderLink } from "@/canvas/RenderLink"
import type { ToInputRenderLink } from "@/canvas/ToInputRenderLink"
import type { LGraphNode } from "@/LGraphNode"
import type { LLink } from "@/LLink"
import type { Reroute } from "@/Reroute"
import type { CanvasPointerEvent } from "@/types/events"
import type { IWidget } from "@/types/widgets"

export interface LinkConnectorEventMap {
  "reset": boolean

  "before-drop-links": {
    renderLinks: RenderLink[]
    event: CanvasPointerEvent
  }
  "after-drop-links": {
    renderLinks: RenderLink[]
    event: CanvasPointerEvent
  }

  "before-move-input": MovingInputLink | FloatingRenderLink
  "before-move-output": MovingOutputLink | FloatingRenderLink

  "input-moved": MovingInputLink | FloatingRenderLink
  "output-moved": MovingOutputLink | FloatingRenderLink

  "link-created": LLink | null | undefined

  "dropped-on-reroute": {
    reroute: Reroute
    event: CanvasPointerEvent
  }
  "dropped-on-node": {
    node: LGraphNode
    event: CanvasPointerEvent
  }
  "dropped-on-canvas": CanvasPointerEvent

  "dropped-on-widget": {
    link: ToInputRenderLink
    node: LGraphNode
    widget: IWidget
  }
}

/** {@link Omit} all properties that evaluate to `never`. */
type NeverNever<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K]
}

/** {@link Pick} only properties that evaluate to `never`. */
type PickNevers<T> = {
  [K in keyof T as T[K] extends never ? K : never]: T[K]
}

type LinkConnectorEventListeners = {
  readonly [K in keyof LinkConnectorEventMap]: ((this: EventTarget, ev: CustomEvent<LinkConnectorEventMap[K]>) => any) | EventListenerObject | null
}

/** Events that _do not_ pass a {@link CustomEvent} `detail` object. */
type SimpleEvents = keyof PickNevers<LinkConnectorEventMap>

/** Events that pass a {@link CustomEvent} `detail` object. */
type ComplexEvents = keyof NeverNever<LinkConnectorEventMap>

export class LinkConnectorEventTarget extends EventTarget {
  /**
   * Type-safe event dispatching.
   * @see {@link EventTarget.dispatchEvent}
   * @param type Name of the event to dispatch
   * @param detail A custom object to send with the event
   * @returns `true` if the event was dispatched successfully, otherwise `false`.
   */
  dispatch<T extends ComplexEvents>(type: T, detail: LinkConnectorEventMap[T]): boolean
  dispatch<T extends SimpleEvents>(type: T): boolean
  dispatch<T extends keyof LinkConnectorEventMap>(type: T, detail?: LinkConnectorEventMap[T]) {
    const event = new CustomEvent(type, { detail, cancelable: true })
    return super.dispatchEvent(event)
  }

  override addEventListener<K extends keyof LinkConnectorEventMap>(
    type: K,
    listener: LinkConnectorEventListeners[K],
    options?: boolean | AddEventListenerOptions,
  ): void {
    // Assertion: Contravariance on CustomEvent => Event
    super.addEventListener(type, listener as EventListener, options)
  }

  override removeEventListener<K extends keyof LinkConnectorEventMap>(
    type: K,
    listener: LinkConnectorEventListeners[K],
    options?: boolean | EventListenerOptions,
  ): void {
    // Assertion: Contravariance on CustomEvent => Event
    super.removeEventListener(type, listener as EventListener, options)
  }

  /** @deprecated Use {@link dispatch}. */
  override dispatchEvent(event: never): boolean {
    return super.dispatchEvent(event)
  }
}
