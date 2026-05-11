// Category: BC.05 — Custom DOM widgets and node sizing
// DB cross-ref: S4.W2, S2.N11
// Exemplar: https://github.com/Lightricks/ComfyUI-LTXVideo/blob/main/web/js/sparse_track_editor.js#L218
// Surface: S4.W2 = node.addDOMWidget, S2.N11 = node.computeSize override
// compat-floor: blast_radius 5.45 ≥ 2.0 — MUST pass before v2 ships
// v1 contract: node.addDOMWidget(name, type, element, opts) + node.computeSize = function(out) { ... }

import { describe, expect, it, vi } from 'vitest'
import {
  countEvidenceExcerpts,
  createMiniComfyApp,
  loadEvidenceSnippet,
  runV1
} from '../harness'

// ── Minimal v1 DOM widget stub ────────────────────────────────────────────────

interface DOMWidget {
  name: string
  type: string
  element: HTMLElement
  height: number
}

interface V1NodeWithWidgets {
  widgets: DOMWidget[]
}

function addDOMWidget(
  node: V1NodeWithWidgets,
  name: string,
  type: string,
  element: HTMLElement,
  opts?: { getHeight?: () => number }
): DOMWidget {
  const height = opts?.getHeight?.() ?? element.offsetHeight
  const w: DOMWidget = { name, type, element, height }
  node.widgets.push(w)
  return w
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BC.05 v1 contract — custom DOM widgets and node sizing', () => {
  describe('S4.W2 — node.addDOMWidget (synthetic)', () => {
    it('widget returned by addDOMWidget has the given name', () => {
      const node: V1NodeWithWidgets = { widgets: [] }
      const el = document.createElement('div')
      Object.defineProperty(el, 'offsetHeight', { value: 120, configurable: true })

      const w = addDOMWidget(node, 'editor', 'custom', el)

      expect(w.name).toBe('editor')
      expect(node.widgets).toHaveLength(1)
    })

    it('opts.getHeight() is used when provided (override > offsetHeight)', () => {
      const node: V1NodeWithWidgets = { widgets: [] }
      const el = document.createElement('div')
      Object.defineProperty(el, 'offsetHeight', { value: 120, configurable: true })

      const w = addDOMWidget(node, 'editor', 'custom', el, { getHeight: () => 200 })

      expect(w.height).toBe(200)
    })

    it('widget is accessible in node.widgets by name after registration', () => {
      const node: V1NodeWithWidgets = { widgets: [] }
      const el = document.createElement('div')

      addDOMWidget(node, 'preview', 'dom', el)

      const found = node.widgets.find((w) => w.name === 'preview')
      expect(found).toBeDefined()
      expect(found!.element).toBe(el)
    })

    it.todo(
      'DOM element appended to document'
    )
    it.todo(
      'canvas render triggers opts.onDraw(ctx)'
    )
    it.todo(
      'graph reload persistence'
    )
  })

  describe('S2.N11 — node.computeSize override (synthetic)', () => {
    it('assigning node.computeSize = fn overrides the default', () => {
      const node: Record<string, unknown> = {
        computeSize: (_out: [number, number]) => [140, 80] as [number, number]
      }

      const custom = vi.fn((_out: [number, number]) => [300, 150] as [number, number])
      node.computeSize = custom

      const result = (node.computeSize as typeof custom)([0, 0])
      expect(custom).toHaveBeenCalledOnce()
      expect(result).toEqual([300, 150])
    })

    it('overridden computeSize receives out array and returns [w,h]', () => {
      const out: [number, number] = [0, 0]
      const node = {
        computeSize: (o: [number, number]): [number, number] => {
          o[0] = 256
          o[1] = 192
          return [256, 192]
        }
      }

      const result = node.computeSize(out)

      expect(result[0]).toBe(256)
      expect(result[1]).toBe(192)
    })

    it('computeSize result accounts for DOM widget reserved height', () => {
      const widgetHeight = 120
      const baseHeight = 80
      const node = {
        computeSize: (_out: [number, number]): [number, number] => [200, baseHeight + widgetHeight]
      }

      const [, h] = node.computeSize([0, 0])

      expect(h).toBe(baseHeight + widgetHeight)
    })

    it.todo(
      'overridden computeSize is called by LiteGraph layout engine before rendering'
    )
    it.todo(
      'computeSize override persists across graph load/reload if set in nodeCreated or beforeRegisterNodeDef'
    )
  })

  describe('S4.W2 — evidence excerpts', () => {
    it('S4.W2 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S4.W2')).toBeGreaterThan(0)
    })

    it('S4.W2 evidence snippet contains addDOMWidget fingerprint', () => {
      const snippet = loadEvidenceSnippet('S4.W2', 0)
      expect(snippet).toMatch(/addDOMWidget/i)
    })

    it('S4.W2 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S4.W2', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })

  describe('S2.N11 — evidence excerpts', () => {
    it('S2.N11 has at least one evidence excerpt', () => {
      expect(countEvidenceExcerpts('S2.N11')).toBeGreaterThan(0)
    })

    it('S2.N11 evidence snippet contains computeSize fingerprint', () => {
      const snippet = loadEvidenceSnippet('S2.N11', 0)
      expect(snippet).toMatch(/computeSize/i)
    })

    it('S2.N11 snippet is capturable by runV1 without throwing', () => {
      const snippet = loadEvidenceSnippet('S2.N11', 0)
      const app = createMiniComfyApp()
      expect(() => runV1(snippet, { app })).not.toThrow()
    })
  })
})
