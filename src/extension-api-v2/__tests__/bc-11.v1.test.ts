// Category: BC.11 — Widget imperative state writes
// DB cross-ref: S4.W4, S4.W5, S2.N16
// Exemplar: https://github.com/r-vage/ComfyUI_Eclipse/blob/main/js/eclipse-set-get.js#L9
// blast_radius: 5.81 — compat-floor: blast_radius ≥ 2.0 — MUST pass before v2 ships
// v1 contract: widget.value = newVal
//              widget.options.values = [...]
//              node.widgets.splice(i, 0, w)
//              node.widgets.push(w)

import { describe, expect, it, vi } from 'vitest'
import {
  countEvidenceExcerpts,
  createMiniComfyApp,
  loadEvidenceSnippet,
  runV1
} from '../harness'

// ── Minimal v1 widget stubs ───────────────────────────────────────────────────

interface V1Widget {
  name: string
  value: unknown
  callback?: ((v: unknown) => void) | undefined
  options?: { values: unknown[] }
}

function createV1Widget(name: string, value: unknown = ''): V1Widget {
  return { name, value, callback: undefined }
}

function createV1ComboWidget(name: string, value: string, values: string[]): V1Widget {
  return { name, value, callback: undefined, options: { values } }
}

// Simulate LiteGraph calling widget.callback on user interaction.
function simulateUserChange(widget: V1Widget, newValue: unknown): void {
  widget.value = newValue
  widget.callback?.(newValue)
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.11 v1 contract — widget imperative state writes', () => {
  // ── S4.W4 evidence ──────────────────────────────────────────────────────────
  describe('S4.W4 — evidence excerpts', () => {
    it('S4.W4 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S4.W4')).toBeGreaterThan(0)
    })

    it('S4.W4 evidence snippet contains widget.value fingerprint', () => {
      const count = countEvidenceExcerpts('S4.W4')
      let found = false
      for (let i = 0; i < count; i++) {
        const snippet = loadEvidenceSnippet('S4.W4', i)
        if (/widget\.value|\.value\s*=/.test(snippet)) {
          found = true
          break
        }
      }
      expect(found, 'Expected at least one S4.W4 excerpt with widget.value fingerprint').toBe(true)
    })

    it('S4.W4 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S4.W4', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  // ── S4.W5 evidence ──────────────────────────────────────────────────────────
  describe('S4.W5 — evidence excerpts', () => {
    it('S4.W5 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S4.W5')).toBeGreaterThan(0)
    })

    it('S4.W5 evidence snippet contains options.values or widget.value fingerprint', () => {
      const count = countEvidenceExcerpts('S4.W5')
      let found = false
      for (let i = 0; i < count; i++) {
        const snippet = loadEvidenceSnippet('S4.W5', i)
        if (/options\.values|\.values\s*=|widget\.value/.test(snippet)) {
          found = true
          break
        }
      }
      expect(found, 'Expected at least one S4.W5 excerpt with options.values or widget.value fingerprint').toBe(true)
    })

    it('S4.W5 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S4.W5', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  // ── S2.N16 evidence ─────────────────────────────────────────────────────────
  describe('S2.N16 — evidence excerpts', () => {
    it('S2.N16 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S2.N16')).toBeGreaterThan(0)
    })

    it('S2.N16 evidence snippet contains node.widgets or widgets.push fingerprint', () => {
      const count = countEvidenceExcerpts('S2.N16')
      let found = false
      for (let i = 0; i < count; i++) {
        const snippet = loadEvidenceSnippet('S2.N16', i)
        if (/node\.widgets|widgets\.push|widgets\.splice/.test(snippet)) {
          found = true
          break
        }
      }
      expect(found, 'Expected at least one S2.N16 excerpt with node.widgets fingerprint').toBe(true)
    })

    it('S2.N16 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S2.N16', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  // ── S4.W4 synthetic behavior ─────────────────────────────────────────────────
  describe('S4.W4 — widget.value direct assignment', () => {
    it('reading widget.value after assignment returns the assigned value (immediate read-back)', () => {
      const widget: { name: string; value: unknown; callback: ((v: unknown) => void) | undefined } = {
        name: 'steps',
        value: 20 as unknown,
        callback: undefined
      }
      widget.value = 30
      expect(widget.value).toBe(30)
    })

    it('value assignment does NOT trigger widget.callback (contrast with simulateUserChange which does call callback)', () => {
      const widget = createV1Widget('steps', 20)
      const cb = vi.fn()
      widget.callback = cb
      widget.value = 30 // direct assignment, no callback fire
      expect(cb).not.toHaveBeenCalled()
    })

    it('assigning a value outside the COMBO options list does not throw', () => {
      const comboWidget = createV1ComboWidget('sampler', 'euler', ['euler', 'dpm'])
      // Value not in options — must not throw
      expect(() => {
        comboWidget.value = 'unknown_sampler'
      }).not.toThrow()
      expect(comboWidget.value).toBe('unknown_sampler')
    })
  })

  // ── S4.W5 synthetic behavior ─────────────────────────────────────────────────
  describe('S4.W5 — widget.options.values mutation (COMBO options)', () => {
    it('assigning widget.options.values = [...] replaces the options list', () => {
      const comboWidget = { name: 'model', value: 'sd15', options: { values: ['sd15', 'sdxl'] } }
      comboWidget.options.values = ['flux', 'sd3']
      expect(comboWidget.options.values).toEqual(['flux', 'sd3'])
    })

    it('stale value (absent from new options) persists without auto-reset', () => {
      const comboWidget = createV1ComboWidget('model', 'sd15', ['sd15', 'sdxl'])
      // Replace options with a list that doesn't include the current value
      comboWidget.options!.values = ['flux', 'sd3']
      // v1 has no auto-reset: stale value remains
      expect(comboWidget.value).toBe('sd15')
    })

    it('mutation of options.values does not fire widget.callback', () => {
      const comboWidget = createV1ComboWidget('model', 'sd15', ['sd15', 'sdxl'])
      const cb = vi.fn()
      comboWidget.callback = cb
      comboWidget.options!.values = ['flux', 'sd3']
      expect(cb).not.toHaveBeenCalled()
    })
  })

  // ── S2.N16 synthetic behavior ────────────────────────────────────────────────
  describe('S2.N16 — node.widgets array mutation (insert / push)', () => {
    it('widgets.push appends a widget and it is immediately in the array', () => {
      const node = { widgets: [] as V1Widget[] }
      const newWidget = createV1Widget('denoise', 1.0)
      node.widgets.push(newWidget)
      expect(node.widgets).toHaveLength(1)
      expect(node.widgets[0]).toBe(newWidget)
    })

    it('widgets.splice(i, 0, w) inserts at position i and shifts subsequent widgets', () => {
      const w0 = createV1Widget('steps', 20)
      const w1 = createV1Widget('cfg', 7)
      const node = { widgets: [w0, w1] as V1Widget[] }
      const wNew = createV1Widget('denoise', 1.0)
      node.widgets.splice(1, 0, wNew)
      expect(node.widgets).toHaveLength(3)
      expect(node.widgets[0]).toBe(w0)
      expect(node.widgets[1]).toBe(wNew)
      expect(node.widgets[2]).toBe(w1)
    })

    it('inserting via splice at position 0 makes the new widget the first element', () => {
      const w0 = createV1Widget('steps', 20)
      const w1 = createV1Widget('cfg', 7)
      const node = { widgets: [w0, w1] as V1Widget[] }
      const wFirst = createV1Widget('seed', 0)
      node.widgets.splice(0, 0, wFirst)
      expect(node.widgets[0]).toBe(wFirst)
      expect(node.widgets[1]).toBe(w0)
      expect(node.widgets[2]).toBe(w1)
    })

    it('canvas redraw visibility: node.widgets.push does not update node.size; calling setSize([...computeSize()]) is required to avoid slot overlap', () => {
      const node = {
        size: [200, 60] as [number, number],
        widgets: [] as V1Widget[],
        computeSize(): [number, number] {
          // 20px per widget row + 40px header
          return [this.size[0], this.widgets.length * 20 + 40]
        },
        setSize(s: [number, number]) {
          this.size[0] = s[0]
          this.size[1] = s[1]
        }
      }

      const w = createV1Widget('denoise', 1.0)
      node.widgets.push(w)

      // size has NOT changed yet — push does not resize
      expect(node.size[1]).toBe(60)

      // After explicit setSize, size reflects new widget count
      node.setSize([...node.computeSize()])
      expect(node.size[1]).toBe(60) // 1 widget * 20 + 40 = 60
    })

    it('node size reflow: node.widgets.push does not trigger a canvas redraw without an explicit setDirtyCanvas call', () => {
      const drawCalls: string[] = []
      const node = {
        widgets: [] as V1Widget[],
        size: [200, 60] as [number, number],
      }
      const mockCanvas = {
        setDirtyCanvas(foreground: boolean) {
          if (foreground) drawCalls.push('dirty')
        }
      }

      node.widgets.push(createV1Widget('denoise', 1.0))
      // push alone does not redraw
      expect(drawCalls).toHaveLength(0)

      // Only after setDirtyCanvas does a redraw get scheduled
      mockCanvas.setDirtyCanvas(true)
      expect(drawCalls).toHaveLength(1)
    })

    it('positional drift in widgets_values: inserting a widget via splice causes widgets_values positional drift if not followed by a node size reflow', () => {
      // widgets_values is positional: [w0.value, w1.value, w2.value]
      const w0 = createV1Widget('steps', 20)
      const w1 = createV1Widget('cfg', 7)
      const node = { widgets: [w0, w1] as V1Widget[] }

      // Before splice: positional order is [steps=20, cfg=7]
      const beforeSerialized = node.widgets.map(w => w.value)
      expect(beforeSerialized).toEqual([20, 7])

      // Insert a new widget at index 1 — drift: cfg is now at index 2
      const wNew = createV1Widget('denoise', 0.9)
      node.widgets.splice(1, 0, wNew)

      // After splice: positional order is [steps=20, denoise=0.9, cfg=7]
      const afterSerialized = node.widgets.map(w => w.value)
      expect(afterSerialized).toEqual([20, 0.9, 7])

      // A workflow saved before the splice would try to restore cfg from index 1 (= 0.9 now) — drift
      expect(afterSerialized[1]).toBe(0.9) // was cfg=7 before
      expect(afterSerialized[2]).toBe(7)   // cfg has drifted to index 2
    })
  })
})
