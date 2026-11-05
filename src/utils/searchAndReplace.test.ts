import { describe, expect, it, vi } from 'vitest'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'
import { applyTextReplacements } from '@/utils/searchAndReplace'

function graphWithWidgetValue(value: string): LGraph {
  const graph = new LGraph()
  const node = new LGraphNode('TestNode')
  node.addWidget('string', 'testWidget', value, () => undefined, {})
  graph.add(node)
  return graph
}

describe('applyTextReplacements', () => {
  describe('date replacements', () => {
    it('preserves a date-prefixed node reference when its widget is missing', () => {
      vi.setSystemTime(new Date(2026, 9, 28, 14, 5, 9))
      const graph = new LGraph()
      const node = new LGraphNode('date:portrait')
      node.addWidget('string', 'renamedWidget', 'portrait', () => undefined, {})
      graph.add(node)

      expect(applyTextReplacements(graph, '%date:portrait.testWidget%')).toBe(
        '%date:portrait.testWidget%'
      )
      expect(console.warn).toHaveBeenCalledWith(
        'Unable to find widget',
        'testWidget',
        'on node',
        'date:portrait',
        node
      )
    })

    it.for([
      { source: 'title', title: 'date:portrait', alias: 'PortraitNode' },
      { source: 'alias', title: 'PortraitNode', alias: 'date:portrait' }
    ])(
      'preserves node references with a date-prefixed $source',
      ({ title, alias }) => {
        vi.setSystemTime(new Date(2026, 9, 28, 14, 5, 9))
        const graph = new LGraph()
        const node = new LGraphNode(title)
        node.properties['Node name for S&R'] = alias
        node.addWidget('string', 'testWidget', 'portrait', () => undefined, {})
        graph.add(node)

        expect(applyTextReplacements(graph, '%date:portrait.testWidget%')).toBe(
          'portrait'
        )
      }
    )

    it.for([
      ['yyyy-MM-dd', '2026-10-28'],
      ['yyyy.MM', '2026.10'],
      ['yyyy.MM.dd', '2026.10.28'],
      ['hh.mm.ss', '14.05.09']
    ])('preserves separators in the date format %s', ([format, expected]) => {
      vi.setSystemTime(new Date(2026, 9, 28, 14, 5, 9))

      expect(applyTextReplacements(new LGraph(), `%date:${format}%`)).toBe(
        expected
      )
    })

    it('combines dated folders and filenames with node widget values', () => {
      vi.setSystemTime(new Date(2026, 9, 28, 14, 5, 9))
      const graph = graphWithWidgetValue('portrait')

      expect(
        applyTextReplacements(
          graph,
          'outputs/%date:yyyy.MM.dd%/%TestNode.testWidget%_%date:hh.mm.ss%'
        )
      ).toBe('outputs/2026.10.28/portrait_14.05.09')
    })
  })

  // Test specifically the filename sanitization part
  describe('filename sanitization', () => {
    it('should replace invalid filename characters with underscores', () => {
      const graph = graphWithWidgetValue(
        'file/name?with<invalid>chars\\:*|"control\x00chars\x1F\x7F'
      )

      const result = applyTextReplacements(graph, '%TestNode.testWidget%')

      // The expected result should have all invalid characters replaced with underscores
      expect(result).toBe('file_name_with_invalid_chars_____control_chars__')
    })

    it('should handle various invalid filename characters individually', () => {
      const invalidChars = [
        '/',
        '?',
        '<',
        '>',
        '\\',
        ':',
        '*',
        '|',
        '"',
        '\x00', // NULL character
        '\x1F', // Unit separator
        '\x7F' // Delete character
      ]

      for (const input of invalidChars) {
        const graph = graphWithWidgetValue(input)
        const result = applyTextReplacements(graph, '%TestNode.testWidget%')
        expect(result, `input ${JSON.stringify(input)}`).toBe('_')
      }
    })

    it('should not modify valid filename characters', () => {
      const validChars = 'abcABC123.-_ '
      const graph = graphWithWidgetValue(validChars)

      const result = applyTextReplacements(graph, '%TestNode.testWidget%')

      expect(result).toBe(validChars)
    })
  })
})
