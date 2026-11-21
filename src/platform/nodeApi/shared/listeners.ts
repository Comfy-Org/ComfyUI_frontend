import { reportError } from '@comfyorg/telemetry/reportError'

import { invalidArgument } from './invalidArgument'

interface Listeners<TArgs extends unknown[]> {
  add(listener: (...args: TArgs) => void): () => void
  /** `add` for a listener a pack passed; anything but a function throws, naming the event. */
  subscribe(listener: unknown): () => void
  drain(...args: TArgs): void
  notify(...args: TArgs): void
  isEmpty(): boolean
}

type IsolatedCall<T> = { ok: true; value: T } | { ok: false }

/** Calls a pack's callback; one that throws is reported, and stops nothing. */
export function callIsolated<T>(
  event: string,
  callback: () => T
): IsolatedCall<T> {
  try {
    const value = callback()
    reportIfRejected(event, value)
    return { ok: true, value }
  } catch (error) {
    reportListenerFailure(event, error)
    return { ok: false }
  }
}

/** Reports the rejection of a promise a pack callback returned, as its throw would be. */
export function reportIfRejected(event: string, returned: unknown): void {
  if (returned instanceof Promise) {
    returned.catch((error: unknown) => reportListenerFailure(event, error))
  }
}

/** Reports a pack callback's failure the way every listener failure is reported. */
export function reportListenerFailure(event: string, error: unknown): void {
  reportError(error, {
    errorType: 'node_api_listener_failure',
    surface: 'platform',
    tags: { event }
  })
}

/** Calls a pack's callback. One that throws is reported and gives `undefined`. */
export function callListener<T>(
  event: string,
  listener: () => T
): T | undefined {
  const result = callIsolated(event, listener)
  return result.ok ? result.value : undefined
}

/** Listeners for one event, each called with the arguments the event carries. */
export function createListeners<TArgs extends unknown[] = []>(
  event: string
): Listeners<TArgs> {
  const registrations = new Set<{
    readonly listener: (...args: TArgs) => void
  }>()
  const call = (listener: (...args: TArgs) => void, args: TArgs) =>
    callListener(event, () => listener(...args))

  function add(listener: (...args: TArgs) => void): () => void {
    const registration = { listener }
    registrations.add(registration)
    return () => {
      registrations.delete(registration)
    }
  }

  return {
    add,
    subscribe(listener) {
      if (typeof listener !== 'function') {
        throw invalidArgument(event, 'a function to call', listener)
      }
      return add((...args) => Reflect.apply(listener, undefined, args))
    },

    drain(...args) {
      for (const registration of Array.from(registrations)) {
        if (registrations.delete(registration))
          call(registration.listener, args)
      }
    },

    notify(...args) {
      for (const registration of Array.from(registrations)) {
        if (registrations.has(registration)) call(registration.listener, args)
      }
    },

    isEmpty: () => registrations.size === 0
  }
}
