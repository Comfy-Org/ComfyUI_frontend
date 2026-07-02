import { describe, expect, it, vi } from 'vitest'

import { LGraph } from '@/lib/litegraph/src/litegraph'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { applyTextReplacements } from '@/utils/searchAndReplace'

function createGraph(nodes: LGraphNode[]) {
  const graph = new LGraph()
  for (const node of nodes) {
    graph.add(node)
  }
  return graph
}

describe('applyTextReplacements', () => {
  // Test specifically the filename sanitization part
  describe('filename sanitization', () => {
    it('should replace invalid filename characters with underscores', () => {
      // Mock the minimal app structure needed
      const mockNodes = [
        {
          title: 'TestNode',
          widgets: [
            {
              name: 'testWidget',
              value:
                'file/name?with<invalid>chars\\:*|"control\x00chars\x1F\x7F'
            }
          ]
        } as LGraphNode
      ]

      const mockGraph = createGraph(mockNodes)
      const result = applyTextReplacements(mockGraph, '%TestNode.testWidget%')

      // The expected result should have all invalid characters replaced with underscores
      expect(result).toBe('file_name_with_invalid_chars_____control_chars__')
    })

    it('should handle various invalid filename characters individually', () => {
      const testCases = [
        { input: '/', expected: '_' },
        { input: '?', expected: '_' },
        { input: '<', expected: '_' },
        { input: '>', expected: '_' },
        { input: '\\', expected: '_' },
        { input: ':', expected: '_' },
        { input: '*', expected: '_' },
        { input: '|', expected: '_' },
        { input: '"', expected: '_' },
        { input: '\x00', expected: '_' }, // NULL character
        { input: '\x1F', expected: '_' }, // Unit separator
        { input: '\x7F', expected: '_' } // Delete character
      ]

      for (const { input, expected } of testCases) {
        const mockNodes = [
          {
            title: 'TestNode',
            widgets: [{ name: 'testWidget', value: input }]
          } as LGraphNode
        ]

        const mockGraph = createGraph(mockNodes)
        const result = applyTextReplacements(mockGraph, '%TestNode.testWidget%')
        expect(result).toBe(expected)
      }
    })

    it('should not modify valid filename characters', () => {
      const validChars = 'abcABC123.-_ '

      const mockNodes = [
        {
          title: 'TestNode',
          widgets: [{ name: 'testWidget', value: validChars }]
        } as LGraphNode
      ]

      const mockGraph = createGraph(mockNodes)
      const result = applyTextReplacements(mockGraph, '%TestNode.testWidget%')
      expect(result).toBe(validChars)
    })
  })

  it('uses the node S&R property name before falling back to title', () => {
    const graph = createGraph([
      {
        title: 'AliasTitle',
        properties: { 'Node name for S&R': 'Alias' },
        widgets: [{ name: 'prompt', value: 'from-alias' }]
      } as LGraphNode,
      {
        title: 'VisibleTitle',
        widgets: [{ name: 'prompt', value: 'from-title' }]
      } as LGraphNode
    ])

    expect(applyTextReplacements(graph, '%Alias.prompt%')).toBe('from-alias')
    expect(applyTextReplacements(graph, '%VisibleTitle.prompt%')).toBe(
      'from-title'
    )
  })

  it('formats date replacements using the current date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-02T03:04:05'))

    try {
      expect(
        applyTextReplacements(new LGraph(), '%date:yyyy-MM-dd_hh-mm-ss%')
      ).toBe('2026-07-02_03-04-05')
    } finally {
      vi.useRealTimers()
    }
  })

  it('keeps unsupported one-part replacements without warning for dimensions', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const graph = new LGraph()

    expect(applyTextReplacements(graph, '%width% %height%')).toBe(
      '%width% %height%'
    )
    expect(warn).not.toHaveBeenCalled()

    warn.mockRestore()
  })

  it('warns and keeps invalid replacement patterns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(applyTextReplacements(new LGraph(), '%too.many.parts%')).toBe(
      '%too.many.parts%'
    )

    expect(warn).toHaveBeenCalledWith(
      'Invalid replacement pattern',
      'too.many.parts'
    )
    warn.mockRestore()
  })

  it('warns when no node matches the replacement', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(applyTextReplacements(new LGraph(), '%Missing.prompt%')).toBe(
      '%Missing.prompt%'
    )

    expect(warn).toHaveBeenCalledWith('Unable to find node', 'Missing')
    warn.mockRestore()
  })

  it('warns and uses the first node when multiple nodes match', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const graph = createGraph([
      {
        title: 'Duplicate',
        widgets: [{ name: 'prompt', value: 'first' }]
      } as LGraphNode,
      {
        title: 'Duplicate',
        widgets: [{ name: 'prompt', value: 'second' }]
      } as LGraphNode
    ])

    expect(applyTextReplacements(graph, '%Duplicate.prompt%')).toBe('first')
    expect(warn).toHaveBeenCalledWith(
      'Multiple nodes matched',
      'Duplicate',
      'using first match'
    )
    warn.mockRestore()
  })

  it('warns when the matched node does not have the requested widget', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const node = {
      title: 'Node',
      widgets: [{ name: 'other', value: 'value' }]
    } as LGraphNode
    const graph = createGraph([node])

    expect(applyTextReplacements(graph, '%Node.prompt%')).toBe('%Node.prompt%')
    expect(warn).toHaveBeenCalledWith(
      'Unable to find widget',
      'prompt',
      'on node',
      'Node',
      node
    )
    warn.mockRestore()
  })

  it('replaces nullish widget values with an empty string', () => {
    const graph = createGraph([
      {
        title: 'Node',
        widgets: [{ name: 'prompt', value: null }]
      } as LGraphNode
    ])

    expect(applyTextReplacements(graph, 'before%Node.prompt%after')).toBe(
      'beforeafter'
    )
  })
})
