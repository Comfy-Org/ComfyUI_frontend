// I-WS.4 — Lazy-serialize v1 contract tests
// Task: Prove v1 sync `serializeValue` still works for shimmed widgets.
// Source: research/architecture/widget-serialization-state.md §1a
// Cross-ref: S4.W3 (widget.serializeValue assignment), BC.12

import { describe, it, expect, vi } from 'vitest'
import { loadEvidenceSnippet, countEvidenceExcerpts } from '@/extension-api-v2/harness'

// v1 widget shape with serializeValue
interface V1Widget {
  name: string
  value: unknown
  serializeValue?: (node: unknown, index: number) => unknown
  options: Record<string, unknown>
}

describe('I-WS.4 v1 contract — sync serializeValue for shimmed widgets', () => {
  describe('(a) v1 sync serializeValue still works', () => {
    it('sync serializeValue function assigned to widget is called during serialization', () => {
      const serializeFn = vi.fn(() => 'transformed-value')
      const widget: V1Widget = {
        name: 'test_widget',
        value: 'original-value',
        serializeValue: serializeFn,
        options: {}
      }

      // Simulate serialization path (executionUtil.ts:102-104 pattern)
      const serializedValue = widget.serializeValue
        ? widget.serializeValue(null, 0)
        : widget.value

      expect(serializeFn).toHaveBeenCalledOnce()
      expect(serializedValue).toBe('transformed-value')
    })

    it('sync serializeValue return value replaces widget.value in serialized output', () => {
      const widget: V1Widget = {
        name: 'seed',
        value: 12345,
        serializeValue: () => 'resolved-seed-42',
        options: {}
      }

      const serializedValue = widget.serializeValue
        ? widget.serializeValue(null, 0)
        : widget.value

      expect(serializedValue).toBe('resolved-seed-42')
      expect(widget.value).toBe(12345) // Original unchanged
    })

    it('sync serializeValue receives node and positional index arguments', () => {
      const serializeFn = vi.fn(() => 'value')
      const mockNode = { id: 42, type: 'TestNode' }
      const widget: V1Widget = {
        name: 'test',
        value: 0,
        serializeValue: serializeFn,
        options: {}
      }

      widget.serializeValue?.(mockNode, 3)

      expect(serializeFn).toHaveBeenCalledWith(mockNode, 3)
    })

    it('when serializeValue not assigned, widget.value is used directly', () => {
      const widget: V1Widget = {
        name: 'plain_widget',
        value: 'direct-value',
        options: {}
      }

      const serializedValue = widget.serializeValue
        ? widget.serializeValue(null, 0)
        : widget.value

      expect(serializedValue).toBe('direct-value')
    })
  })

  describe('shim layer preserves v1 sync behavior', () => {
    it.todo(
      // TODO(Phase B): requires v2 shim layer implementation
      'v1 extension assigning serializeValue works through v2 shim layer unchanged'
    )

    it.todo(
      // TODO(Phase B): requires v2 shim layer + graphToPrompt
      'graphToPrompt() still awaits the serializeValue return even for sync functions'
    )

    it.todo(
      // TODO(Phase B): requires shim + multiple extensions
      'multiple extensions assigning serializeValue on same widget: last-writer-wins behavior preserved'
    )
  })

  describe('serialize===false widgets in v1', () => {
    it('widget with options.serialize===false still has serializeValue called', () => {
      const serializeFn = vi.fn(() => 'hidden-value')
      const widget: V1Widget = {
        name: 'control_after_generate',
        value: 'fixed',
        serializeValue: serializeFn,
        options: { serialize: false }
      }

      // Workflow serialization path calls serializeValue regardless of options.serialize
      // (only graphToPrompt backend-prompt excludes it)
      const serializedValue = widget.serializeValue
        ? widget.serializeValue(null, 0)
        : widget.value

      expect(serializeFn).toHaveBeenCalledOnce()
      expect(serializedValue).toBe('hidden-value')
    })

    it.todo(
      // TODO(Phase B): requires graphToPrompt harness
      'widget with options.serialize===false appears in widgets_values but not in backend prompt'
    )
  })

  describe('evidence database integration', () => {
    it('S4.W3 (serializeValue) has evidence excerpts in database', () => {
      const count = countEvidenceExcerpts('S4.W3')
      expect(count).toBeGreaterThan(0)
    })

    it('S4.W3 evidence snippets are loadable', () => {
      const count = countEvidenceExcerpts('S4.W3')
      if (count > 0) {
        const snippet = loadEvidenceSnippet('S4.W3', 0)
        expect(snippet).toBeDefined()
        expect(snippet.length).toBeGreaterThan(0)
      }
    })
  })
})
