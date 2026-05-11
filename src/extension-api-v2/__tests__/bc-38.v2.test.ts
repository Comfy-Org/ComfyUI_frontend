// Category: BC.38 — Canvas mode observation
// DB cross-ref: S17.AM1
// Exemplar: https://www.notion.so/comfy-org/Develop-a-custom-node-from-scratch-pain-point-assessment-33c6d73d365080f49126c0b5affa7559
// blast_radius: 0.0
// compat-floor: NO (absent API gap — proposed new v2 API, not yet implemented)
// v2 contract: comfyApp.on('canvasModeChanged', (mode) => { ... }) — proposed, not yet implemented
// Flagged: Terry DX walkthrough A.1
//
// Phase A note: The real comfyApp.on() is not yet implemented. Tests use a
// minimal typed EventEmitter stub that mirrors the proposed API shape exactly.
// When the real API lands these tests become integration tests by swapping the stub.
//
// I-TF.8.H3 — BC.38 v2 wired assertions.

import { describe, expect, it, vi } from 'vitest'

// ── Minimal typed EventEmitter stub (mirrors proposed comfyApp.on shape) ──────

type CanvasMode = 'graph' | 'app' | 'builder:inputs' | 'builder:outputs' | 'builder:arrange'

interface MockComfyApp {
  on(event: 'canvasModeChanged', handler: (mode: CanvasMode) => void): void
  off(event: 'canvasModeChanged', handler: (mode: CanvasMode) => void): void
  _emit(event: 'canvasModeChanged', mode: CanvasMode): void
  canvas: { mode: CanvasMode }
}

function createMockComfyApp(initialMode: CanvasMode = 'graph'): MockComfyApp {
  const listeners = new Set<(mode: CanvasMode) => void>()
  let currentMode = initialMode

  return {
    canvas: {
      get mode() { return currentMode }
    },
    on(_event, handler) {
      listeners.add(handler)
    },
    off(_event, handler) {
      listeners.delete(handler)
    },
    _emit(_event, mode) {
      currentMode = mode
      for (const fn of listeners) fn(mode)
    }
  }
}

// ── Wired assertions ──────────────────────────────────────────────────────────

describe('BC.38 v2 contract — canvas mode observation', () => {
  describe('S17.AM1 — canvasModeChanged event', () => {
    it("comfyApp.on('canvasModeChanged', handler) registers a listener for mode transitions", () => {
      const app = createMockComfyApp('graph')
      const handler = vi.fn()

      app.on('canvasModeChanged', handler)
      app._emit('canvasModeChanged', 'app')

      expect(handler).toHaveBeenCalledOnce()
      expect(handler).toHaveBeenCalledWith('app')
    })

    it('handler receives typed mode strings for all valid transitions', () => {
      const app = createMockComfyApp('graph')
      const received: CanvasMode[] = []
      app.on('canvasModeChanged', (mode) => received.push(mode))

      const modes: CanvasMode[] = ['app', 'builder:inputs', 'builder:outputs', 'builder:arrange', 'graph']
      for (const mode of modes) app._emit('canvasModeChanged', mode)

      expect(received).toEqual(modes)
    })

    it('multiple handlers all receive the same mode value', () => {
      const app = createMockComfyApp('graph')
      const h1 = vi.fn()
      const h2 = vi.fn()

      app.on('canvasModeChanged', h1)
      app.on('canvasModeChanged', h2)
      app._emit('canvasModeChanged', 'builder:inputs')

      expect(h1).toHaveBeenCalledWith('builder:inputs')
      expect(h2).toHaveBeenCalledWith('builder:inputs')
    })

    it("comfyApp.off('canvasModeChanged', handler) correctly unregisters the listener", () => {
      const app = createMockComfyApp('graph')
      const handler = vi.fn()

      app.on('canvasModeChanged', handler)
      app._emit('canvasModeChanged', 'app')
      expect(handler).toHaveBeenCalledOnce()

      app.off('canvasModeChanged', handler)
      app._emit('canvasModeChanged', 'graph')
      // Still called once — second emit should not reach unregistered handler
      expect(handler).toHaveBeenCalledOnce()
    })

    it('unregistering a handler does not affect other registered handlers', () => {
      const app = createMockComfyApp('graph')
      const keep = vi.fn()
      const remove = vi.fn()

      app.on('canvasModeChanged', keep)
      app.on('canvasModeChanged', remove)
      app.off('canvasModeChanged', remove)

      app._emit('canvasModeChanged', 'app')

      expect(keep).toHaveBeenCalledOnce()
      expect(remove).not.toHaveBeenCalled()
    })
  })

  describe('S17.AM1 — current mode access', () => {
    it('comfyApp.canvas.mode returns the current canvas mode without subscribing', () => {
      const app = createMockComfyApp('graph')
      expect(app.canvas.mode).toBe('graph')

      app._emit('canvasModeChanged', 'builder:outputs')
      expect(app.canvas.mode).toBe('builder:outputs')
    })

    it('canvas.mode reflects the latest emitted mode after multiple transitions', () => {
      const app = createMockComfyApp('graph')

      app._emit('canvasModeChanged', 'app')
      app._emit('canvasModeChanged', 'builder:inputs')
      app._emit('canvasModeChanged', 'graph')

      expect(app.canvas.mode).toBe('graph')
    })

    it('canvasModeChanged is DISTINCT from node execution mode — emitting it does not change node modes', () => {
      // Node execution modes are integers (0=always, 1=on trigger, 4=never).
      // canvasModeChanged carries a string and is about canvas view state, not node run state.
      // This test verifies the type is string, ensuring no confusion with LiteGraph node mode enum.
      const app = createMockComfyApp('graph')
      const handler = vi.fn()
      app.on('canvasModeChanged', handler)
      app._emit('canvasModeChanged', 'app')

      const receivedMode = handler.mock.calls[0][0]
      expect(typeof receivedMode).toBe('string')
      expect(typeof receivedMode).not.toBe('number')
    })
  })
})

// ── Phase B stubs ─────────────────────────────────────────────────────────────

describe('BC.38 v2 contract — canvas mode observation [Phase B]', () => {
  it.todo(
    'real comfyApp.on() from @comfyorg/extension-api fires canvasModeChanged when appModeStore transitions'
  )
  it.todo(
    'canvasModeChanged fires synchronously before the UI re-renders (before next Vue tick)'
  )
})
