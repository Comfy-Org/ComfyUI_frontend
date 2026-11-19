import { createListeners } from '@/platform/nodeApi/shared/listeners'
import type { Unsubscribe } from './types'

interface AppLifecycle {
  onReady(listener: () => void): Unsubscribe
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

    markReady() {
      ready = true
      waiting.drain()
    }
  }
}
