import { describe, it, expect, vi, beforeEach } from 'vitest'

// -- Mock Firebase Auth module properly
vi.mock('firebase/auth', async (importOriginal) => {
  const actualModule = await importOriginal()
  const actual = actualModule as Record<string, any>
  return {
    ...actual,
    GoogleAuthProvider: class {
      setCustomParameters = vi.fn()
    },
    GithubAuthProvider: class {
      setCustomParameters = vi.fn()
    },
    setPersistence: vi.fn().mockResolvedValue(undefined),
    browserLocalPersistence: {},
    onAuthStateChanged: vi.fn(),
  }
})


// -- Mock canvas getContext to avoid "null" errors in tests
beforeEach(() => {
  HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((type) => {
    if (type === '2d') {
      return {
        scale: vi.fn(),
        clearRect: vi.fn(),
        fillRect: vi.fn(),
        drawImage: vi.fn(),
        // Add more canvas methods your code uses here as needed
      }
    }
    return null
  })
})

// -- Example test suite for your component (simplified)
describe('GraphCanvas.vue - Video Delete Key Handling', () => {
  it('should prevent Delete key from deleting video elements', () => {
    // Spy on event methods
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()

    // Mock event representing Delete key press
    const event = new KeyboardEvent('keydown', { key: 'Delete' })

    // Override event methods
    Object.defineProperty(event, 'preventDefault', { value: preventDefault })
    Object.defineProperty(event, 'stopPropagation', { value: stopPropagation })

    // Simulate the actual handler logic:
    // For example: call a function that handles keydown and
    // calls preventDefault and stopPropagation if focused element is a video node

    // You should replace this with your actual keydown handler call or component method call
    function onDeleteKey(event: KeyboardEvent) {
      const focusedElementIsVideo = true // pretend the video element is focused

      if (event.key === 'Delete' && focusedElementIsVideo) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    onDeleteKey(event)

    // Now test that event methods were called
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(stopPropagation).toHaveBeenCalledOnce()
  })

  it('should NOT block Delete key if non-video element is focused', () => {
    const preventDefault = vi.fn()
    const stopPropagation = vi.fn()

    const event = new KeyboardEvent('keydown', { key: 'Delete' })

    Object.defineProperty(event, 'preventDefault', { value: preventDefault })
    Object.defineProperty(event, 'stopPropagation', { value: stopPropagation })

    function onDeleteKey(event: KeyboardEvent) {
      const focusedElementIsVideo = false

      if (event.key === 'Delete' && focusedElementIsVideo) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    onDeleteKey(event)

    expect(preventDefault).not.toHaveBeenCalled()
    expect(stopPropagation).not.toHaveBeenCalled()
  })
})
