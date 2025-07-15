import type { CapturedEvent } from "./subgraphHelpers"

import { expect } from "vitest"

/**
 * Extended captured event with additional metadata not in the base infrastructure
 */
export interface ExtendedCapturedEvent<T = unknown> extends CapturedEvent<T> {
  defaultPrevented: boolean
  bubbles: boolean
  cancelable: boolean
}

/**
 * Creates an enhanced event capture that includes additional event properties
 * This extends the basic createEventCapture with more metadata
 */
export function createExtendedEventCapture<T = unknown>(
  eventTarget: EventTarget,
  eventTypes: string[],
) {
  const capturedEvents: ExtendedCapturedEvent<T>[] = []
  const listeners: Array<() => void> = []

  for (const eventType of eventTypes) {
    const listener = (event: Event) => {
      capturedEvents.push({
        type: eventType,
        detail: (event as CustomEvent<T>).detail,
        timestamp: Date.now(),
        defaultPrevented: event.defaultPrevented,
        bubbles: event.bubbles,
        cancelable: event.cancelable,
      })
    }

    eventTarget.addEventListener(eventType, listener)
    listeners.push(() => eventTarget.removeEventListener(eventType, listener))
  }

  return {
    events: capturedEvents,
    clear: () => { capturedEvents.length = 0 },
    cleanup: () => { for (const cleanup of listeners) cleanup() },
    getEventsByType: (type: string) => capturedEvents.filter(e => e.type === type),
    getLatestEvent: () => capturedEvents.at(-1),
    getFirstEvent: () => capturedEvents[0],

    /**
     * Wait for a specific event type to be captured
     */
    async waitForEvent(type: string, timeoutMs: number = 1000): Promise<ExtendedCapturedEvent<T>> {
      const existingEvent = capturedEvents.find(e => e.type === type)
      if (existingEvent) return existingEvent

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          eventTarget.removeEventListener(type, eventListener)
          reject(new Error(`Event ${type} not received within ${timeoutMs}ms`))
        }, timeoutMs)

        const eventListener = (_event: Event) => {
          const capturedEvent = capturedEvents.find(e => e.type === type)
          if (capturedEvent) {
            clearTimeout(timeout)
            eventTarget.removeEventListener(type, eventListener)
            resolve(capturedEvent)
          }
        }

        eventTarget.addEventListener(type, eventListener)
      })
    },

    /**
     * Wait for a sequence of events to occur in order
     */
    async waitForSequence(expectedSequence: string[], timeoutMs: number = 1000): Promise<ExtendedCapturedEvent<T>[]> {
      // Check if sequence is already complete
      if (capturedEvents.length >= expectedSequence.length) {
        const actualSequence = capturedEvents.slice(0, expectedSequence.length).map(e => e.type)
        if (JSON.stringify(actualSequence) === JSON.stringify(expectedSequence)) {
          return capturedEvents.slice(0, expectedSequence.length)
        }
      }

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          cleanup()
          const actual = capturedEvents.map(e => e.type).join(", ")
          const expected = expectedSequence.join(", ")
          reject(new Error(`Event sequence not completed within ${timeoutMs}ms. Expected: ${expected}, Got: ${actual}`))
        }, timeoutMs)

        const checkSequence = () => {
          if (capturedEvents.length >= expectedSequence.length) {
            const actualSequence = capturedEvents.slice(0, expectedSequence.length).map(e => e.type)
            if (JSON.stringify(actualSequence) === JSON.stringify(expectedSequence)) {
              cleanup()
              resolve(capturedEvents.slice(0, expectedSequence.length))
            }
          }
        }

        const eventListener = () => checkSequence()

        const cleanup = () => {
          clearTimeout(timeout)
          for (const type of expectedSequence) {
            eventTarget.removeEventListener(type, eventListener)
          }
        }

        // Listen for all expected event types
        for (const type of expectedSequence) {
          eventTarget.addEventListener(type, eventListener)
        }

        // Initial check in case events already exist
        checkSequence()
      })
    },
  }
}

/**
 * Options for memory leak testing
 */
export interface MemoryLeakTestOptions {
  cycles?: number
  instancesPerCycle?: number
  gcAfterEach?: boolean
  maxMemoryGrowth?: number
}

/**
 * Creates a memory leak test factory
 * Useful for testing that event listeners and references are properly cleaned up
 */
export function createMemoryLeakTest<T>(
  setupFn: () => { ref: WeakRef<T>, cleanup: () => void },
  options: MemoryLeakTestOptions = {},
) {
  const {
    cycles = 1,
    instancesPerCycle = 1,
    gcAfterEach = true,
    maxMemoryGrowth = 0,
  } = options

  return async () => {
    const refs: WeakRef<T>[] = []
    const initialMemory = process.memoryUsage?.()?.heapUsed || 0

    for (let cycle = 0; cycle < cycles; cycle++) {
      const cycleRefs: WeakRef<T>[] = []

      for (let instance = 0; instance < instancesPerCycle; instance++) {
        const { ref, cleanup } = setupFn()
        cycleRefs.push(ref)
        cleanup()
      }

      refs.push(...cycleRefs)

      if (gcAfterEach && global.gc) {
        global.gc()
        await new Promise(resolve => setTimeout(resolve, 10))
      }
    }

    // Final garbage collection
    if (global.gc) {
      global.gc()
      await new Promise(resolve => setTimeout(resolve, 50))

      // Check if objects were collected
      const uncollectedRefs = refs.filter(ref => ref.deref() !== undefined)
      if (uncollectedRefs.length > 0) {
        console.warn(`${uncollectedRefs.length} objects were not garbage collected`)
      }
    }

    // Memory growth check
    if (maxMemoryGrowth > 0 && process.memoryUsage) {
      const finalMemory = process.memoryUsage().heapUsed
      const memoryGrowth = finalMemory - initialMemory

      if (memoryGrowth > maxMemoryGrowth) {
        throw new Error(`Memory growth ${memoryGrowth} bytes exceeds limit ${maxMemoryGrowth} bytes`)
      }
    }

    return refs
  }
}

/**
 * Creates a performance monitor for event operations
 */
export function createEventPerformanceMonitor() {
  const measurements: Array<{
    operation: string
    duration: number
    timestamp: number
  }> = []

  return {
    measure: <T>(operation: string, fn: () => T): T => {
      const start = performance.now()
      const result = fn()
      const end = performance.now()

      measurements.push({
        operation,
        duration: end - start,
        timestamp: start,
      })

      return result
    },

    getMeasurements: () => [...measurements],

    getAverageDuration: (operation: string) => {
      const operationMeasurements = measurements.filter(m => m.operation === operation)
      if (operationMeasurements.length === 0) return 0

      const totalDuration = operationMeasurements.reduce((sum, m) => sum + m.duration, 0)
      return totalDuration / operationMeasurements.length
    },

    clear: () => { measurements.length = 0 },

    assertPerformance: (operation: string, maxDuration: number) => {
      const measurements = this.getMeasurements()
      const relevantMeasurements = measurements.filter(m => m.operation === operation)
      if (relevantMeasurements.length === 0) return

      const avgDuration = relevantMeasurements.reduce((sum, m) => sum + m.duration, 0) / relevantMeasurements.length
      expect(avgDuration).toBeLessThan(maxDuration)
    },
  }
}
