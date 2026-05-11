// Category: BC.38 — Canvas mode observation
// DB cross-ref: S17.AM1
// Exemplar: https://www.notion.so/comfy-org/Develop-a-custom-node-from-scratch-pain-point-assessment-33c6d73d365080f49126c0b5affa7559
// blast_radius: 0.0
// compat-floor: NO (absent API gap — no stable v1 API exists)
// v1 contract: no API — must poll app.canvas.mode or use heuristics (broken)
// Note: appModeStore is a Pinia composable; JS extensions cannot use Vue composables directly.
//       DISTINCT from NodeModeChangedEvent (execution mode: muted/bypass/always/once/trigger).

import { describe, expect, it, vi } from 'vitest'

// Synthetic canvas with a mode property (matches LiteGraph LGraphCanvas shape)
function makeCanvas(initialMode: number) {
  return { mode: initialMode }
}

// v1 polling workaround: poll canvas.mode on an interval and call onChange when it changes
function pollCanvasMode(
  canvas: { mode: number },
  onChange: (newMode: number, oldMode: number) => void,
  intervalMs = 0,
) {
  let last = canvas.mode
  const id = setInterval(() => {
    if (canvas.mode !== last) {
      const prev = last
      last = canvas.mode
      onChange(canvas.mode, prev)
    }
  }, intervalMs)
  return id
}

describe('BC.38 v1 contract — canvas mode observation', () => {
  describe('S17.AM1 — polling workaround', () => {
    it('extension can read app.canvas.mode synchronously to determine the current canvas mode', () => {
      const canvas = makeCanvas(0) // 0 = graph mode
      expect(canvas.mode).toBe(0)

      canvas.mode = 2 // 2 = builder mode (hypothetical)
      expect(canvas.mode).toBe(2)
    })

    it('polling canvas.mode on an interval detects a mode transition', () =>
      new Promise<void>((resolve) => {
        vi.useFakeTimers()
        const canvas = makeCanvas(0)
        const transitions: Array<[number, number]> = []

        const id = pollCanvasMode(canvas, (n, o) => transitions.push([o, n]), 10)

        setTimeout(() => { canvas.mode = 1 }, 20) // switch to app mode

        vi.advanceTimersByTime(40)
        clearInterval(id)
        vi.useRealTimers()

        expect(transitions).toHaveLength(1)
        expect(transitions[0]).toEqual([0, 1])
        resolve()
      }))

    it('polling detects multiple sequential mode transitions', () =>
      new Promise<void>((resolve) => {
        vi.useFakeTimers()
        const canvas = makeCanvas(0)
        const transitions: Array<[number, number]> = []

        const id = pollCanvasMode(canvas, (n, o) => transitions.push([o, n]), 5)

        setTimeout(() => { canvas.mode = 1 }, 10)
        setTimeout(() => { canvas.mode = 2 }, 25)
        setTimeout(() => { canvas.mode = 0 }, 40)

        vi.advanceTimersByTime(60)
        clearInterval(id)
        vi.useRealTimers()

        expect(transitions).toHaveLength(3)
        expect(transitions[0]).toEqual([0, 1])
        expect(transitions[1]).toEqual([1, 2])
        expect(transitions[2]).toEqual([2, 0])
        resolve()
      }))
  })

  describe('S17.AM1 — absence of stable hook', () => {
    it('NodeModeChangedEvent is distinct from canvas mode — it carries node execution mode (muted/bypass)', () => {
      // NodeModeChangedEvent payload has { node, oldMode, newMode } where mode values are
      // LiteGraph node modes (ALWAYS=0, ON_EVENT=1, NEVER=2, ON_TRIGGER=3)
      // Canvas modes are completely different (graph/app/builder) — extensions must not conflate them
      const nodeModeEvent = {
        type: 'NodeModeChangedEvent',
        node: { id: 5 },
        oldMode: 0, // ALWAYS
        newMode: 2, // NEVER (muted)
      }
      const canvasMode = 0 // graph canvas mode

      expect(nodeModeEvent.type).toBe('NodeModeChangedEvent')
      expect(nodeModeEvent.newMode).not.toBe(canvasMode) // different dimension
      // Canvas mode 0 = "graph mode", NodeMode 0 = "ALWAYS execute" — same number, different meaning
    })

    it('v1 app object has no on() method for canvas mode change events', () => {
      const app = {
        canvas: makeCanvas(0),
        graph: {},
        // no on(), no addEventListener() for canvas mode
      } as Record<string, unknown>

      expect(app['on']).toBeUndefined()
      expect(typeof app['canvas']).toBe('object')
      // polling or MutationObserver on DOM classes is the only v1 workaround
    })

    it('heuristic: DOM class detection is the alternative but is fragile to HTML structure changes', () => {
      // v1 heuristic: check for a class on a top-level element to infer canvas mode
      const app = document.createElement('div')
      app.id = 'app'
      document.body.appendChild(app)

      // Simulate "graph mode" by adding a class
      app.classList.add('graph-mode')
      const isGraphMode = app.classList.contains('graph-mode')
      expect(isGraphMode).toBe(true)

      // Simulate mode switch — old class removed, new class added
      app.classList.remove('graph-mode')
      app.classList.add('app-mode')
      expect(app.classList.contains('graph-mode')).toBe(false)
      expect(app.classList.contains('app-mode')).toBe(true)

      document.body.removeChild(app)
      // This heuristic breaks if ComfyUI renames the CSS classes
    })
  })
})
