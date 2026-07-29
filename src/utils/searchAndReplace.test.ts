import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

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
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
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
