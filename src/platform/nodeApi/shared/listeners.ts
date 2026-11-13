import { reportError } from '@comfyorg/telemetry/reportError'

interface Listeners {
  add(listener: () => void): () => void
  drain(): void
}

type IsolatedCall<T> = { ok: true; value: T } | { ok: false }

/** Calls a pack's callback; one that throws is reported, and stops nothing. */
export function callIsolated<T>(
  event: string,
  callback: () => T
): IsolatedCall<T> {
  try {
    return { ok: true, value: callback() }
  } catch (error) {
    reportError(error, {
      errorType: 'node_api_listener_failure',
      surface: 'platform',
      tags: { event }
    })
    return { ok: false }
  }
}

export function createListeners(event: string): Listeners {
  const registrations = new Set<{ readonly listener: () => void }>()

  return {
    add(listener) {
      const registration = { listener }
      registrations.add(registration)
      return () => {
        registrations.delete(registration)
      }
    },

    drain() {
      for (const registration of Array.from(registrations)) {
        if (registrations.delete(registration)) {
          callIsolated(event, registration.listener)
        }
      }
    }
  }
}
