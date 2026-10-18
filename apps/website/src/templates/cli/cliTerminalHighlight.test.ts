import { describe, expect, it } from 'vitest'
import { highlightTokens } from '@/lib/highlight'
import { terminalTokens } from './cliTerminalHighlight'
import { cliTerminalSequences } from './cliTerminalSequences'

describe('CLI terminal syntax', () => {
  it('uses Router shell grammar and theme without losing command text', () => {
    const line = cliTerminalSequences[0].lines[0]
    const actual = terminalTokens(line, '$ ' + line.text)
    expect(actual.slice(1)).toEqual(highlightTokens(line.text, 'shell'))
    expect(new Set(actual.map((token) => token.color)).size).toBeGreaterThan(2)
    expect(actual.map((token) => token.content).join('')).toBe('$ ' + line.text)
  })

  it('preserves every typed prefix including partial quoted strings', () => {
    const line = cliTerminalSequences[0].lines[0]
    const full = '$ ' + line.text
    for (let length = 1; length <= full.length; length++) {
      const prefix = full.slice(0, length)
      expect(
        terminalTokens(line, prefix)
          .map((t) => t.content)
          .join('')
      ).toBe(prefix)
    }
  })

  it('highlights JSON output as JSON and keeps ordinary output plain', () => {
    const text = '{ "ok": true, "count": 3 }'
    expect(terminalTokens({ kind: 'out', text }, text)).toEqual(
      highlightTokens(text, 'json')
    )
    expect(terminalTokens({ kind: 'out', text: 'running' }, 'running')).toEqual(
      [{ content: 'running' }]
    )
  })
})
