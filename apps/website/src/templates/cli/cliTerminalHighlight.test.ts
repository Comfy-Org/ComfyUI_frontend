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

  it.for([
    '$',
    '$ ',
    '$ comfy',
    '$ comfy generate flux-pro --prompt "',
    '$ comfy generate flux-pro --prompt "a cat'
  ])('preserves typed prefix %s', (prefix) => {
    const line = {
      kind: 'cmd' as const,
      text: 'comfy generate flux-pro --prompt "a cat"'
    }
    expect(
      terminalTokens(line, prefix)
        .map((token) => token.content)
        .join('')
    ).toBe(prefix)
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
