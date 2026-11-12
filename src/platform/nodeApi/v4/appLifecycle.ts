import { invalidArgument } from '@/platform/nodeApi/shared/invalidArgument'
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
      if (typeof listener !== 'function') {
        throw invalidArgument('onReady', 'a function to call', listener)
      }
      const stop = waiting.add(listener)
      if (ready) queueMicrotask(waiting.drain)
      return stop
    },

    markReady() {
      ready = true
      waiting.drain()
    }
  }
}
