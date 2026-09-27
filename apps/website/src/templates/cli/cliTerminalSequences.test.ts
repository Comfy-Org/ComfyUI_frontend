import { describe, expect, it } from 'vitest'

import { cliTerminalSequences } from './cliTerminalSequences'

describe('cliTerminalSequences', () => {
  it('has at least one sequence for the terminal to cycle through', () => {
    expect(cliTerminalSequences.length).toBeGreaterThan(0)
  })

  it('keys every sequence with a unique id', () => {
    const ids = cliTerminalSequences.map((sequence) => sequence.id)

    expect(new Set(ids).size).toBe(ids.length)
  })

  describe.each(cliTerminalSequences)('sequence $id', (sequence) => {
    it('opens with a typed command', () => {
      expect(sequence.lines.at(0)?.kind).toBe('cmd')
    })

    it('has non-empty text on every line', () => {
      for (const line of sequence.lines) {
        expect(line.text.trim()).not.toBe('')
      }
    })

    it('follows every command with a response line', () => {
      for (const [index, line] of sequence.lines.entries()) {
        if (line.kind !== 'cmd') continue

        expect(['out', 'ok']).toContain(sequence.lines.at(index + 1)?.kind)
      }
    })

    it('ends on an ok marker so the held frame shows success', () => {
      expect(sequence.lines.at(-1)?.kind).toBe('ok')
    })
  })
})
