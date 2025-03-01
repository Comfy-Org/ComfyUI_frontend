import type { LGraphNode } from '@comfyorg/litegraph'
import { describe, expect, it } from 'vitest'

import { applyTextReplacements } from '@/utils/searchAndReplace'

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

      const result = applyTextReplacements(mockNodes, '%TestNode.testWidget%')

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

        const result = applyTextReplacements(mockNodes, '%TestNode.testWidget%')
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

      const result = applyTextReplacements(mockNodes, '%TestNode.testWidget%')
      expect(result).toBe(validChars)
    })
  })
})
