import { beforeEach, describe, expect, it } from 'vitest'

import { CanvasPointer } from '../src/CanvasPointer'

describe('CanvasPointer', () => {
  let element: HTMLDivElement
  let pointer: CanvasPointer

  beforeEach(() => {
    element = document.createElement('div')
    pointer = new CanvasPointer(element)
    // Reset static configuration
    CanvasPointer.trackpadThreshold = 60
  })

  describe('isTrackpadGesture', () => {
    describe('detent detection for mouse wheels', () => {
      it('should detect mouse wheel with consistent detent of 10 (Linux high DPI)', () => {
        // Simulate Linux high DPI mouse wheel events with detent = 10
        const events = [
          { deltaY: 10, deltaX: 0 },
          { deltaY: 20, deltaX: 0 },
          { deltaY: 10, deltaX: 0 },
          { deltaY: 40, deltaX: 0 },
          { deltaY: 10, deltaX: 0 }
        ]

        // First event stores the delta, second event detects the pattern
        events.forEach((eventData, index) => {
          const event = new WheelEvent('wheel', eventData)
          const isTrackpad = pointer.isTrackpadGesture(event)

          // After 2 events where both are multiples of 10, the pattern should be detected
          // First event: stores 10
          // Second event: 20 is multiple of 10, detects mouse wheel
          // Third+ events: continue detecting mouse wheel
          if (index >= 1) {
            expect(isTrackpad).toBe(false) // Should be detected as mouse wheel
            expect(pointer.lastIntegerDelta).toBe(10)
          }
        })
      })

      it('should detect mouse wheel with consistent detent of 120 (traditional)', () => {
        // Traditional mouse wheel with detent = 120
        const events = [
          { deltaY: 120, deltaX: 0 },
          { deltaY: -120, deltaX: 0 },
          { deltaY: 240, deltaX: 0 },
          { deltaY: 120, deltaX: 0 }
        ]

        events.forEach((eventData) => {
          const event = new WheelEvent('wheel', eventData)
          const isTrackpad = pointer.isTrackpadGesture(event)

          // These values exceed threshold (60), so would be mouse wheel anyway
          expect(isTrackpad).toBe(false)
        })
      })

      it('should not detect detent for values below minimum threshold', () => {
        // Very small values that have GCD < 5
        const events = [
          { deltaY: 3, deltaX: 0 },
          { deltaY: 6, deltaX: 0 },
          { deltaY: 3, deltaX: 0 },
          { deltaY: 9, deltaX: 0 }
        ]

        events.forEach((eventData) => {
          const event = new WheelEvent('wheel', eventData)
          const isTrackpad = pointer.isTrackpadGesture(event)

          // Should be detected as trackpad (small values, no valid detent)
          expect(isTrackpad).toBe(true)
        })

        // The lastIntegerDelta would be 3 from the first event
        expect(pointer.lastIntegerDelta).toBe(3)
      })
    })

    describe('trackpad detection', () => {
      it('should detect trackpad with smooth scrolling values', () => {
        // Trackpad with smooth, non-detent values
        const events = [
          { deltaY: 2.5, deltaX: 0 },
          { deltaY: 5.75, deltaX: 0.25 },
          { deltaY: 8.333, deltaX: 0 },
          { deltaY: 3.14159, deltaX: 0 }
        ]

        events.forEach((eventData) => {
          const event = new WheelEvent('wheel', eventData)
          const isTrackpad = pointer.isTrackpadGesture(event)

          // Should be detected as trackpad (fractional values)
          expect(isTrackpad).toBe(true)
        })
      })

      it('should detect trackpad with horizontal scrolling', () => {
        const event = new WheelEvent('wheel', {
          deltaY: 5,
          deltaX: 10 // Non-zero deltaX suggests 2D scrolling
        })

        expect(pointer.isTrackpadGesture(event)).toBe(true)
      })

      it('should detect trackpad continuation within time gap', () => {
        const event1 = new WheelEvent('wheel', {
          deltaY: 5,
          deltaX: 0
        })

        const event2 = new WheelEvent('wheel', {
          deltaY: 100, // Large value, but within continuation window
          deltaX: 0 // Within trackpadMaxGap (200ms)
        })

        pointer.isTrackpadGesture(event1)
        expect(pointer.isTrackpadGesture(event2)).toBe(true) // Continuation
      })

      it('should not continue trackpad after time gap', () => {
        const event1 = new WheelEvent('wheel', {
          deltaY: 5,
          deltaX: 0
        })
        // Mock timestamp
        Object.defineProperty(event1, 'timeStamp', {
          value: 100,
          writable: false
        })

        const event2 = new WheelEvent('wheel', {
          deltaY: 100,
          deltaX: 0
        })
        // Mock timestamp beyond trackpadMaxGap (200ms)
        Object.defineProperty(event2, 'timeStamp', {
          value: 350,
          writable: false
        })

        pointer.isTrackpadGesture(event1)
        expect(pointer.isTrackpadGesture(event2)).toBe(false) // Not continuation
      })
    })

    describe('bug fix: lastTrackpadEvent saving', () => {
      it('should save lastTrackpadEvent on initial detection', () => {
        const event = new WheelEvent('wheel', {
          deltaY: 5,
          deltaX: 0
        })

        expect(pointer.lastTrackpadEvent).toBeUndefined()
        pointer.isTrackpadGesture(event)
        expect(pointer.lastTrackpadEvent).toBe(event)
      })

      it('should update lastTrackpadEvent on continuation', () => {
        const event1 = new WheelEvent('wheel', {
          deltaY: 5,
          deltaX: 0
        })

        const event2 = new WheelEvent('wheel', {
          deltaY: 8,
          deltaX: 0
        })

        pointer.isTrackpadGesture(event1)
        pointer.isTrackpadGesture(event2)
        expect(pointer.lastTrackpadEvent).toBe(event2)
      })
    })

    describe('additional heuristics', () => {
      it('should detect trackpad with non-integer deltaY', () => {
        const event = new WheelEvent('wheel', {
          deltaY: 5.5, // Non-integer value
          deltaX: 0
        })

        expect(pointer.isTrackpadGesture(event)).toBe(true)
      })

      it('should detect trackpad with very small pixel mode values', () => {
        const event = new WheelEvent('wheel', {
          deltaY: 3,
          deltaX: 0,
          deltaMode: 0 // DOM_DELTA_PIXEL
        })

        expect(pointer.isTrackpadGesture(event)).toBe(true)
      })
    })

    describe('configuration', () => {
      it('should respect trackpadThreshold configuration', () => {
        CanvasPointer.trackpadThreshold = 30

        const event = new WheelEvent('wheel', {
          deltaY: 40, // Above new threshold
          deltaX: 0
        })

        expect(pointer.isTrackpadGesture(event)).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should handle zero deltaY values', () => {
        const event = new WheelEvent('wheel', {
          deltaY: 0,
          deltaX: 0
        })

        expect(pointer.isTrackpadGesture(event)).toBe(true)
      })

      it('should handle negative deltaY values in detent detection', () => {
        const events = [
          { deltaY: -10, deltaX: 0 },
          { deltaY: 20, deltaX: 0 },
          { deltaY: -30, deltaX: 0 },
          { deltaY: 10, deltaX: 0 }
        ]

        events.forEach((eventData, index) => {
          const event = new WheelEvent('wheel', eventData)
          pointer.isTrackpadGesture(event)

          if (index >= 1) {
            // Should detect detent of 10 despite mixed signs
            expect(pointer.lastIntegerDelta).toBe(10)
          }
        })
      })

      it('should detect mouse wheel pattern regardless of time gap', () => {
        // Add first event
        const event1 = new WheelEvent('wheel', {
          deltaY: 10,
          deltaX: 0
        })
        pointer.isTrackpadGesture(event1)
        expect(pointer.lastIntegerDelta).toBe(10)

        // Add second event - should detect mouse wheel pattern
        const event2 = new WheelEvent('wheel', {
          deltaY: 20,
          deltaX: 0
        })
        const isTrackpad = pointer.isTrackpadGesture(event2)

        // Should detect as mouse wheel (both are multiples of 10)
        expect(isTrackpad).toBe(false)
        expect(pointer.lastIntegerDelta).toBe(10) // The detected detent
      })
    })
  })
})
