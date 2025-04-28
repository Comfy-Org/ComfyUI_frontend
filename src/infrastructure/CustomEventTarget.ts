/** {@link Omit} all properties that evaluate to `never`. */
type NeverNever<T> = {
  [K in keyof T as T[K] extends never ? never : K]: T[K]
}

/** {@link Pick} only properties that evaluate to `never`. */
type PickNevers<T> = {
  [K in keyof T as T[K] extends never ? K : never]: T[K]
}

type EventListeners<T> = {
  readonly [K in keyof T]: ((this: EventTarget, ev: CustomEvent<T[K]>) => any) | EventListenerObject | null
}

export class CustomEventTarget<
  EventMap extends Record<Keys, unknown>,
  Keys extends keyof EventMap & string = keyof EventMap & string,
> extends EventTarget {
  /**
   * Type-safe event dispatching.
   * @see {@link EventTarget.dispatchEvent}
   * @param type Name of the event to dispatch
   * @param detail A custom object to send with the event
   * @returns `true` if the event was dispatched successfully, otherwise `false`.
   */
  dispatch<T extends keyof NeverNever<EventMap>>(type: T, detail: EventMap[T]): boolean
  dispatch<T extends keyof PickNevers<EventMap>>(type: T): boolean
  dispatch<T extends keyof EventMap>(type: T, detail?: EventMap[T]) {
    const event = new CustomEvent(type as string, { detail, cancelable: true })
    return super.dispatchEvent(event)
  }

  override addEventListener<K extends Keys>(
    type: K,
    listener: EventListeners<EventMap>[K],
    options?: boolean | AddEventListenerOptions,
  ): void {
    // Assertion: Contravariance on CustomEvent => Event
    super.addEventListener(type as string, listener as EventListener, options)
  }

  override removeEventListener<K extends Keys>(
    type: K,
    listener: EventListeners<EventMap>[K],
    options?: boolean | EventListenerOptions,
  ): void {
    // Assertion: Contravariance on CustomEvent => Event
    super.removeEventListener(type as string, listener as EventListener, options)
  }

  /** @deprecated Use {@link dispatch}. */
  override dispatchEvent(event: never): boolean {
    return super.dispatchEvent(event)
  }
}
