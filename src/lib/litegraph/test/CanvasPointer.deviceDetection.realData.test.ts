/**
 * Real QA Data Tests for CanvasPointer Device Detection
 *
 * This file contains tests based on actual device data collected from QA testing.
 * Each test represents real-world behavior from specific devices and platforms.
 *
 * Test Structure:
 * - Platform: The operating system (Mac, Windows, Linux)
 * - Device: The specific input device (mouse, trackpad, precision touchpad)
 * - Gesture: The type of interaction (scroll, pinch-to-zoom, two-finger pan)
 * - Data: Exact event sequences as captured from real devices
 *
 * @vitest-environment jsdom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CanvasPointer } from '../src/CanvasPointer'

describe('CanvasPointer Device Detection - Real QA Data Tests', () => {
  let element: HTMLDivElement
  let pointer: CanvasPointer
  let originalPlatform: string

  beforeEach(() => {
    element = document.createElement('div')
    pointer = new CanvasPointer(element)
    vi.spyOn(performance, 'now').mockReturnValue(0)
    vi.spyOn(global, 'setTimeout')
    vi.spyOn(global, 'clearTimeout')

    originalPlatform = navigator.platform
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.clearAllTimers()

    Object.defineProperty(navigator, 'platform', {
      value: originalPlatform,
      writable: true,
      configurable: true
    })
  })

  function mockPlatform(platform: 'Mac' | 'Windows' | 'Linux') {
    const platformMap = {
      Mac: 'MacIntel',
      Windows: 'Win32',
      Linux: 'Linux x86_64'
    }

    Object.defineProperty(navigator, 'platform', {
      value: platformMap[platform],
      writable: true,
      configurable: true
    })
  }

  describe('Mouse wheel detection from real devices', () => {
    it('should detect mouse from QA data: Mac mouse with negative wheelDelta pattern', () => {
      // Platform: macOS (Mac)
      // Device: Mouse
      // Expected: All events should be detected as mouse
      mockPlatform('Mac')

      const testSequence = [
        { deltaX: 0, deltaY: 12, wheelDeltaY: -36 },
        { deltaX: 0, deltaY: 13, wheelDeltaY: -39 },
        { deltaX: 0, deltaY: 12, wheelDeltaY: -36 },
        { deltaX: 0, deltaY: 13, wheelDeltaY: -39 }
      ]

      pointer = new CanvasPointer(element)

      testSequence.forEach((eventData, index) => {
        // Mock time progression (16ms between events for ~60fps)
        vi.spyOn(performance, 'now').mockReturnValue(index * 16)

        const event = new WheelEvent('wheel', {
          deltaX: eventData.deltaX,
          deltaY: eventData.deltaY
        })

        Object.defineProperty(event, 'wheelDeltaY', {
          value: eventData.wheelDeltaY,
          writable: false
        })

        const result = pointer.isTrackpadGesture(event)

        expect(pointer.detectedDevice).toBe('mouse')
        expect(result).toBe(false)
      })
    })

    it('should detect mouse from QA data: Mac mouse events with varying deltaY values', () => {
      // This test captures the pattern where deltaY varies slightly (12, 13, 12, 13)
      // but wheelDeltaY maintains the 3x ratio (-36, -39, -36, -39)
      // Platform: macOS (Mac)
      mockPlatform('Mac')

      const testSequence = [
        { deltaX: 0, deltaY: 12, wheelDeltaY: -36, expectedDevice: 'mouse' },
        { deltaX: 0, deltaY: 13, wheelDeltaY: -39, expectedDevice: 'mouse' },
        { deltaX: 0, deltaY: 12, wheelDeltaY: -36, expectedDevice: 'mouse' },
        { deltaX: 0, deltaY: 13, wheelDeltaY: -39, expectedDevice: 'mouse' }
      ]

      pointer = new CanvasPointer(element)

      testSequence.forEach((eventData, index) => {
        vi.spyOn(performance, 'now').mockReturnValue(index * 20)

        const event = new WheelEvent('wheel', {
          deltaX: eventData.deltaX,
          deltaY: eventData.deltaY
        })

        Object.defineProperty(event, 'wheelDeltaY', {
          value: eventData.wheelDeltaY,
          writable: false
        })

        pointer.isTrackpadGesture(event)
        expect(pointer.detectedDevice).toBe(eventData.expectedDevice)
      })
    })

    it('should detect mouse from QA data: Mac mouse with varying scroll speeds', () => {
      // Real data from QA testing showing mouse wheel behavior with different scroll speeds
      // Platform: macOS (Mac)
      // Device: Mouse (with varying scroll speeds)
      // Expected: All events should be detected as mouse
      mockPlatform('Mac')

      const testSequence = [
        { deltaX: 0, deltaY: 13, wheelDeltaY: -39, expectedDevice: 'mouse' },
        { deltaX: 0, deltaY: 13, wheelDeltaY: -39, expectedDevice: 'mouse' },
        { deltaX: 0, deltaY: 26, wheelDeltaY: -78, expectedDevice: 'mouse' }, // Double speed scroll
        { deltaX: 0, deltaY: -13, wheelDeltaY: 39, expectedDevice: 'mouse' }, // Reverse direction
        { deltaX: 0, deltaY: 12, wheelDeltaY: -36, expectedDevice: 'mouse' }
      ]

      pointer = new CanvasPointer(element)

      testSequence.forEach((eventData, index) => {
        vi.spyOn(performance, 'now').mockReturnValue(index * 16)

        const event = new WheelEvent('wheel', {
          deltaX: eventData.deltaX,
          deltaY: eventData.deltaY
        })

        Object.defineProperty(event, 'wheelDeltaY', {
          value: eventData.wheelDeltaY,
          writable: false
        })

        const result = pointer.isTrackpadGesture(event)

        expect(pointer.detectedDevice).toBe(eventData.expectedDevice)
        expect(result).toBe(false) // Not trackpad
      })
    })

    it('should detect mouse from QA data: Mac mouse with small deltaY pattern', () => {
      // Real data from QA testing showing Mac mouse with smaller deltaY values
      // Platform: macOS (Mac)
      // Device: Mouse (slower/precise scrolling)
      // Expected: All events should be detected as mouse
      // Note: deltaY is 4.000244140625 with wheelDeltaY of ±120 (30x ratio)
      mockPlatform('Mac')

      const testSequence = [
        {
          deltaX: 0,
          deltaY: 4.000244140625,
          wheelDeltaY: -120,
          expectedDevice: 'mouse'
        },
        {
          deltaX: 0,
          deltaY: -4.000244140625,
          wheelDeltaY: 120,
          expectedDevice: 'mouse'
        },
        {
          deltaX: 0,
          deltaY: 4.000244140625,
          wheelDeltaY: -120,
          expectedDevice: 'mouse'
        },
        {
          deltaX: 0,
          deltaY: -4.000244140625,
          wheelDeltaY: 120,
          expectedDevice: 'mouse'
        },
        {
          deltaX: 0,
          deltaY: 4.000244140625,
          wheelDeltaY: -120,
          expectedDevice: 'mouse'
        }
      ]

      pointer = new CanvasPointer(element)

      testSequence.forEach((eventData, index) => {
        vi.spyOn(performance, 'now').mockReturnValue(index * 16)

        const event = new WheelEvent('wheel', {
          deltaX: eventData.deltaX,
          deltaY: eventData.deltaY
        })

        Object.defineProperty(event, 'wheelDeltaY', {
          value: eventData.wheelDeltaY,
          writable: false
        })

        const result = pointer.isTrackpadGesture(event)

        expect(pointer.detectedDevice).toBe(eventData.expectedDevice)
        expect(result).toBe(false) // Not trackpad
      })
    })

    it('should detect mouse from QA data: Windows mouse with high precision values', () => {
      // Real data from QA testing showing Windows mouse wheel behavior
      // Platform: Windows
      // Device: Mouse with high-precision scrolling
      // Expected: All events should be detected as mouse
      // Note: Windows has characteristic fractional deltaY values like 111.111...
      mockPlatform('Windows')

      const testSequence = [
        {
          deltaX: 0,
          deltaY: -111.11111615700719,
          wheelDeltaY: 133,
          expectedDevice: 'mouse'
        },
        {
          deltaX: 0,
          deltaY: 111.11111615700719,
          wheelDeltaY: -133,
          expectedDevice: 'mouse'
        },
        {
          deltaX: 0,
          deltaY: -111.11111615700719,
          wheelDeltaY: 133,
          expectedDevice: 'mouse'
        },
        {
          deltaX: 0,
          deltaY: -111.11111615700719,
          wheelDeltaY: 133,
          expectedDevice: 'mouse'
        }
      ]

      pointer = new CanvasPointer(element)

      testSequence.forEach((eventData, index) => {
        vi.spyOn(performance, 'now').mockReturnValue(index * 16)

        const event = new WheelEvent('wheel', {
          deltaX: eventData.deltaX,
          deltaY: eventData.deltaY
        })

        Object.defineProperty(event, 'wheelDeltaY', {
          value: eventData.wheelDeltaY,
          writable: false
        })

        const result = pointer.isTrackpadGesture(event)

        expect(pointer.detectedDevice).toBe(eventData.expectedDevice)
        expect(result).toBe(false) // Not trackpad
      })
    })

    it('should detect mouse from QA data: Windows mouse with integer deltaY pattern', () => {
      // Real data from QA testing showing Windows mouse wheel behavior
      // Platform: Windows
      // Device: Mouse with standard scrolling
      // Expected: All events should be detected as mouse
      // Note: Windows mouse with clean integer deltaY of 100 and wheelDeltaY of ±120
      mockPlatform('Windows')

      const testSequence = [
        { deltaX: 0, deltaY: 100, wheelDeltaY: -120, expectedDevice: 'mouse' },
        { deltaX: 0, deltaY: -100, wheelDeltaY: 120, expectedDevice: 'mouse' },
        { deltaX: 0, deltaY: 100, wheelDeltaY: -120, expectedDevice: 'mouse' },
        { deltaX: 0, deltaY: 100, wheelDeltaY: -120, expectedDevice: 'mouse' },
        { deltaX: 0, deltaY: -100, wheelDeltaY: 120, expectedDevice: 'mouse' },
        { deltaX: 0, deltaY: 100, wheelDeltaY: -120, expectedDevice: 'mouse' },
        { deltaX: 0, deltaY: 100, wheelDeltaY: -120, expectedDevice: 'mouse' },
        { deltaX: 0, deltaY: -100, wheelDeltaY: 120, expectedDevice: 'mouse' }
      ]

      pointer = new CanvasPointer(element)

      testSequence.forEach((eventData, index) => {
        vi.spyOn(performance, 'now').mockReturnValue(index * 16)

        const event = new WheelEvent('wheel', {
          deltaX: eventData.deltaX,
          deltaY: eventData.deltaY
        })

        Object.defineProperty(event, 'wheelDeltaY', {
          value: eventData.wheelDeltaY,
          writable: false
        })

        const result = pointer.isTrackpadGesture(event)

        expect(pointer.detectedDevice).toBe(eventData.expectedDevice)
        expect(result).toBe(false) // Not trackpad
      })
    })
  })

  describe('Trackpad detection from real devices', () => {
    it('should detect trackpad from QA data: Windows trackpad pinch-to-zoom', () => {
      // Platform: Windows
      // Device: Precision Touchpad (pinch-to-zoom gesture)
      // Expected: All events should be detected as trackpad
      // Note: Windows trackpad has small deltaY values but constant wheelDeltaY
      mockPlatform('Windows')

      const testSequence = [
        {
          deltaX: 0,
          deltaY: -3.3135088654249674,
          wheelDeltaY: 133,
          ctrlKey: true,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: 8.94965318420894,
          wheelDeltaY: -133,
          ctrlKey: true,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: -3.654589743292812,
          wheelDeltaY: 133,
          ctrlKey: true,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: -23.625750933408778,
          wheelDeltaY: 133,
          ctrlKey: true,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: -3.616658329584863,
          wheelDeltaY: 133,
          ctrlKey: true,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: -1.999075238624841,
          wheelDeltaY: 133,
          ctrlKey: true,
          expectedDevice: 'trackpad'
        }
      ]

      pointer = new CanvasPointer(element)

      testSequence.forEach((eventData, index) => {
        vi.spyOn(performance, 'now').mockReturnValue(index * 16)

        const event = new WheelEvent('wheel', {
          deltaX: eventData.deltaX,
          deltaY: eventData.deltaY,
          ctrlKey: eventData.ctrlKey
        })

        Object.defineProperty(event, 'wheelDeltaY', {
          value: eventData.wheelDeltaY,
          writable: false
        })

        const result = pointer.isTrackpadGesture(event)

        expect(pointer.detectedDevice).toBe(eventData.expectedDevice)
        expect(result).toBe(true) // Is trackpad
      })
    })

    it('should detect trackpad from QA data: Windows trackpad two-finger scroll', () => {
      // Platform: Windows
      // Device: Precision Touchpad (two-finger vertical scroll)
      // Expected: All events should be detected as trackpad
      // Note: Windows trackpad has small deltaY values with matching small wheelDeltaY
      mockPlatform('Windows')

      const testSequence = [
        {
          deltaX: 0,
          deltaY: -2.222222323140144,
          wheelDeltaY: 2,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: 1.111111161570072,
          wheelDeltaY: -1,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: 16.66666742355108,
          wheelDeltaY: -16,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: 4.444444646280288,
          wheelDeltaY: -4,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: 4.444444646280288,
          wheelDeltaY: -4,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: 5.55555580785036,
          wheelDeltaY: -5,
          expectedDevice: 'trackpad'
        }
      ]

      pointer = new CanvasPointer(element)

      testSequence.forEach((eventData, index) => {
        vi.spyOn(performance, 'now').mockReturnValue(index * 16)

        const event = new WheelEvent('wheel', {
          deltaX: eventData.deltaX,
          deltaY: eventData.deltaY
        })

        Object.defineProperty(event, 'wheelDeltaY', {
          value: eventData.wheelDeltaY,
          writable: false
        })

        const result = pointer.isTrackpadGesture(event)

        expect(pointer.detectedDevice).toBe(eventData.expectedDevice)
        expect(result).toBe(true) // Is trackpad
      })
    })

    it('should detect trackpad from QA data: Windows trackpad horizontal scroll', () => {
      // Real data from QA testing showing Windows trackpad horizontal scroll behavior
      // Platform: Windows
      // Device: Precision Touchpad (two-finger horizontal scroll)
      // Expected: All events should be detected as trackpad
      // Note: Windows trackpad horizontal scroll has deltaX only, no deltaY or wheelDeltaY
      mockPlatform('Windows')

      const testSequence = [
        {
          deltaX: -33.33333484710216,
          deltaY: 0,
          wheelDeltaY: 0,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: -37.77777949338245,
          deltaY: 0,
          wheelDeltaY: 0,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 73.33333666362475,
          deltaY: 0,
          wheelDeltaY: 0,
          expectedDevice: 'trackpad'
        }
      ]

      pointer = new CanvasPointer(element)

      testSequence.forEach((eventData, index) => {
        vi.spyOn(performance, 'now').mockReturnValue(index * 16)

        const event = new WheelEvent('wheel', {
          deltaX: eventData.deltaX,
          deltaY: eventData.deltaY
        })

        Object.defineProperty(event, 'wheelDeltaY', {
          value: eventData.wheelDeltaY,
          writable: false
        })

        const result = pointer.isTrackpadGesture(event)

        expect(pointer.detectedDevice).toBe(eventData.expectedDevice)
        expect(result).toBe(true) // Is trackpad
      })
    })

    it('should detect trackpad from QA data: Mac trackpad pinch-to-zoom', () => {
      // Real data from QA testing showing trackpad pinch-to-zoom behavior
      // Platform: macOS (Mac)
      // Device: MacBook Trackpad (pinch-to-zoom gesture)
      // Expected: All events should be detected as trackpad
      // Note: ctrlKey is true for pinch-to-zoom on Mac
      mockPlatform('Mac')

      const testSequence = [
        {
          deltaX: 0,
          deltaY: 1.206591010093689,
          wheelDeltaY: -120,
          ctrlKey: true,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: -1.3895320892333984,
          wheelDeltaY: 120,
          ctrlKey: true,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: -0.5978795289993286,
          wheelDeltaY: 120,
          ctrlKey: true,
          expectedDevice: 'trackpad'
        }
      ]

      pointer = new CanvasPointer(element)

      testSequence.forEach((eventData, index) => {
        vi.spyOn(performance, 'now').mockReturnValue(index * 16)

        const event = new WheelEvent('wheel', {
          deltaX: eventData.deltaX,
          deltaY: eventData.deltaY,
          ctrlKey: eventData.ctrlKey
        })

        Object.defineProperty(event, 'wheelDeltaY', {
          value: eventData.wheelDeltaY,
          writable: false
        })

        const result = pointer.isTrackpadGesture(event)

        expect(pointer.detectedDevice).toBe(eventData.expectedDevice)
        expect(result).toBe(true) // Is trackpad
      })
    })

    it('should detect trackpad from QA data: Mac trackpad pinch-to-zoom (set 2)', () => {
      // Real data from QA testing showing another Mac trackpad pinch-to-zoom pattern
      // Platform: macOS (Mac)
      // Device: MacBook Trackpad (pinch-to-zoom gesture)
      // Expected: All events should be detected as trackpad
      // Note: ctrlKey is true for pinch-to-zoom on Mac, deltaY values vary more in this set
      mockPlatform('Mac')

      const testSequence = [
        {
          deltaX: 0,
          deltaY: 1.9179956912994385,
          wheelDeltaY: -120,
          ctrlKey: true,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: -1.9791855812072754,
          wheelDeltaY: 120,
          ctrlKey: true,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: -0.8947280049324036,
          wheelDeltaY: 120,
          ctrlKey: true,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: -0.8947280049324036,
          wheelDeltaY: 120,
          ctrlKey: true,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: 0.80277419090271,
          wheelDeltaY: -120,
          ctrlKey: true,
          expectedDevice: 'trackpad'
        }
      ]

      pointer = new CanvasPointer(element)

      testSequence.forEach((eventData, index) => {
        vi.spyOn(performance, 'now').mockReturnValue(index * 16)

        const event = new WheelEvent('wheel', {
          deltaX: eventData.deltaX,
          deltaY: eventData.deltaY,
          ctrlKey: eventData.ctrlKey
        })

        Object.defineProperty(event, 'wheelDeltaY', {
          value: eventData.wheelDeltaY,
          writable: false
        })

        const result = pointer.isTrackpadGesture(event)

        expect(pointer.detectedDevice).toBe(eventData.expectedDevice)
        expect(result).toBe(true) // Is trackpad
      })
    })

    it('should detect trackpad from QA data: Mac trackpad horizontal scroll', () => {
      // Real data from QA testing showing Mac trackpad horizontal scroll behavior
      // Platform: macOS (Mac)
      // Device: MacBook Trackpad (two-finger horizontal scroll)
      // Expected: All events should be detected as trackpad
      // Note: Mac trackpad horizontal scroll has integer deltaX values, no deltaY or wheelDeltaY
      mockPlatform('Mac')

      const testSequence = [
        { deltaX: 9, deltaY: 0, wheelDeltaY: 0, expectedDevice: 'trackpad' },
        { deltaX: -6, deltaY: 0, wheelDeltaY: 0, expectedDevice: 'trackpad' },
        { deltaX: 2, deltaY: 0, wheelDeltaY: 0, expectedDevice: 'trackpad' },
        { deltaX: -3, deltaY: 0, wheelDeltaY: 0, expectedDevice: 'trackpad' },
        { deltaX: 2, deltaY: 0, wheelDeltaY: 0, expectedDevice: 'trackpad' },
        { deltaX: -2, deltaY: 0, wheelDeltaY: 0, expectedDevice: 'trackpad' }
      ]

      pointer = new CanvasPointer(element)

      testSequence.forEach((eventData, index) => {
        vi.spyOn(performance, 'now').mockReturnValue(index * 16)

        const event = new WheelEvent('wheel', {
          deltaX: eventData.deltaX,
          deltaY: eventData.deltaY
        })

        Object.defineProperty(event, 'wheelDeltaY', {
          value: eventData.wheelDeltaY,
          writable: false
        })

        const result = pointer.isTrackpadGesture(event)

        expect(pointer.detectedDevice).toBe(eventData.expectedDevice)
        expect(result).toBe(true) // Is trackpad
      })
    })

    it('should detect trackpad from QA data: Mac trackpad vertical scroll', () => {
      // Real data from QA testing showing Mac trackpad vertical scroll behavior
      // Platform: macOS (Mac)
      // Device: MacBook Trackpad (two-finger vertical scroll)
      // Expected: All events should be detected as trackpad
      // Note: Mac trackpad vertical scroll has very small integer deltaY (±1) with wheelDeltaY (±3)
      mockPlatform('Mac')

      const testSequence = [
        { deltaX: 0, deltaY: 1, wheelDeltaY: -3, expectedDevice: 'trackpad' },
        { deltaX: 0, deltaY: -1, wheelDeltaY: 3, expectedDevice: 'trackpad' },
        { deltaX: 0, deltaY: 1, wheelDeltaY: -3, expectedDevice: 'trackpad' },
        { deltaX: 0, deltaY: 1, wheelDeltaY: -3, expectedDevice: 'trackpad' },
        { deltaX: 0, deltaY: 1, wheelDeltaY: -3, expectedDevice: 'trackpad' },
        { deltaX: 0, deltaY: -1, wheelDeltaY: 3, expectedDevice: 'trackpad' }
      ]

      pointer = new CanvasPointer(element)

      testSequence.forEach((eventData, index) => {
        vi.spyOn(performance, 'now').mockReturnValue(index * 16)

        const event = new WheelEvent('wheel', {
          deltaX: eventData.deltaX,
          deltaY: eventData.deltaY
        })

        Object.defineProperty(event, 'wheelDeltaY', {
          value: eventData.wheelDeltaY,
          writable: false
        })

        const result = pointer.isTrackpadGesture(event)

        expect(pointer.detectedDevice).toBe(eventData.expectedDevice)
        expect(result).toBe(true) // Is trackpad
      })
    })

    it('should detect trackpad from QA data: Windows trackpad mixed gestures', () => {
      // Real data from QA testing showing Windows trackpad with various gestures
      // Platform: Windows
      // Device: Precision Touchpad (mixed two-finger scrolling)
      // Expected: All events should be detected as trackpad
      // Note: This sequence shows both horizontal and vertical scrolling patterns
      mockPlatform('Windows')

      const testSequence = [
        {
          deltaX: 34.4444453,
          deltaY: 31.1111119,
          wheelDeltaY: -31,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: -3.3333334,
          deltaY: -1.1111114,
          wheelDeltaY: 1,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: -37.77777877854715,
          wheelDeltaY: 37,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: -28.88888965,
          wheelDeltaY: 28,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: -62.22222387054825,
          wheelDeltaY: 62,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: 6.666666843,
          wheelDeltaY: -6,
          expectedDevice: 'trackpad'
        }
      ]

      pointer = new CanvasPointer(element)

      testSequence.forEach((eventData, index) => {
        // Allow some time between events to avoid cooldown period
        vi.spyOn(performance, 'now').mockReturnValue(index * 100)

        const event = new WheelEvent('wheel', {
          deltaX: eventData.deltaX,
          deltaY: eventData.deltaY
        })

        Object.defineProperty(event, 'wheelDeltaY', {
          value: eventData.wheelDeltaY,
          writable: false
        })

        const result = pointer.isTrackpadGesture(event)

        expect(pointer.detectedDevice).toBe(eventData.expectedDevice)
        expect(result).toBe(true) // Is trackpad
      })
    })

    it('should detect trackpad from QA data: Windows trackpad vertical scroll', () => {
      // Real data from QA testing showing Windows trackpad two-finger vertical scrolling
      // Platform: Windows
      // Device: Precision Touchpad (two-finger vertical scroll)
      // Expected: All events should be detected as trackpad
      // Note: Windows trackpad shows small deltaY values with matching wheelDeltaY (opposite sign)
      mockPlatform('Windows')

      const testSequence = [
        { deltaX: 0, deltaY: -6, wheelDeltaY: 6, expectedDevice: 'trackpad' },
        { deltaX: 0, deltaY: 1, wheelDeltaY: -1, expectedDevice: 'trackpad' },
        { deltaX: 0, deltaY: -19, wheelDeltaY: 18, expectedDevice: 'trackpad' },
        { deltaX: 0, deltaY: 38, wheelDeltaY: -37, expectedDevice: 'trackpad' },
        { deltaX: 0, deltaY: -4, wheelDeltaY: 4, expectedDevice: 'trackpad' },
        { deltaX: 0, deltaY: -21, wheelDeltaY: 21, expectedDevice: 'trackpad' }
      ]

      pointer = new CanvasPointer(element)

      testSequence.forEach((eventData, index) => {
        vi.spyOn(performance, 'now').mockReturnValue(index * 16)

        const event = new WheelEvent('wheel', {
          deltaX: eventData.deltaX,
          deltaY: eventData.deltaY
        })

        Object.defineProperty(event, 'wheelDeltaY', {
          value: eventData.wheelDeltaY,
          writable: false
        })

        const result = pointer.isTrackpadGesture(event)

        expect(pointer.detectedDevice).toBe(eventData.expectedDevice)
        expect(result).toBe(true) // Is trackpad
      })
    })

    it('should detect trackpad from QA data: Windows trackpad pinch gesture', () => {
      // Real data from QA testing showing Windows trackpad pinch-to-zoom behavior
      // Platform: Windows
      // Device: Precision Touchpad (pinch gesture)
      // Expected: All events should be detected as trackpad
      // Note: Windows trackpad shows small decimal deltaY values with standard wheelDeltaY (-120/120)
      mockPlatform('Windows')

      const testSequence = [
        {
          deltaX: 0,
          deltaY: 0.7864023208,
          wheelDeltaY: -120,
          ctrlKey: true,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: -1.8231786727,
          wheelDeltaY: 120,
          ctrlKey: true,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: -5.795222473,
          wheelDeltaY: 120,
          ctrlKey: true,
          expectedDevice: 'trackpad'
        },
        {
          deltaX: 0,
          deltaY: -2.065727996,
          wheelDeltaY: 120,
          ctrlKey: true,
          expectedDevice: 'trackpad'
        }
      ]

      pointer = new CanvasPointer(element)

      testSequence.forEach((eventData, index) => {
        vi.spyOn(performance, 'now').mockReturnValue(index * 16)

        const event = new WheelEvent('wheel', {
          deltaX: eventData.deltaX,
          deltaY: eventData.deltaY,
          ctrlKey: eventData.ctrlKey
        })

        Object.defineProperty(event, 'wheelDeltaY', {
          value: eventData.wheelDeltaY,
          writable: false
        })

        const result = pointer.isTrackpadGesture(event)

        expect(pointer.detectedDevice).toBe(eventData.expectedDevice)
        expect(result).toBe(true)
      })
    })
  })
})
