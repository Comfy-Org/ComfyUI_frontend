import { reportError } from '@comfyorg/telemetry/reportError'

interface Listeners {
  add(listener: () => void): () => void
  drain(): void
}

export function createListeners(event: string): Listeners {
  const registrations = new Set<{ readonly listener: () => void }>()

  function call(listener: () => void): void {
    try {
      listener()
    } catch (error) {
      reportError(error, {
        errorType: 'node_api_listener_failure',
        surface: 'platform',
        tags: { event }
      })
    }
  }

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
        if (registrations.delete(registration)) call(registration.listener)
      }
    }
  }
}
