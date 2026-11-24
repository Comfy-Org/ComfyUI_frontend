import { createListeners } from '@/platform/nodeApi/shared/listeners'
import type { Unsubscribe } from './types'

interface AppLifecycle {
  onReady(listener: () => void): Unsubscribe
  markStarting(): void
  markReady(): void
}

export function createAppLifecycle(): AppLifecycle {
  const waiting = createListeners('onReady')
  let ready = false

  return {
    onReady(listener) {
      const stop = waiting.subscribe(listener)
      if (ready) queueMicrotask(waiting.drain)
      return stop
    },

    markStarting() {
      ready = false
    },

    markReady() {
      if (ready) return
      ready = true
      waiting.drain()
    }
  }
}
