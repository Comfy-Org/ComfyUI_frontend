import type { MockInstance } from 'vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { box, displayWidth, fail, info, pass, warn } from './logger'

describe('displayWidth', () => {
  it('counts plain text by character', () => {
    expect(displayWidth('pnpm dev')).toBe(8)
  })

  it('ignores ANSI colour codes', () => {
    expect(displayWidth('\u001b[36mpnpm dev\u001b[39m')).toBe(8)
  })

  it('counts emoji as two cells', () => {
    expect(displayWidth('👉 go')).toBe(5)
  })

  it('does not count a variation selector', () => {
    expect(displayWidth('⚠️')).toBe(1)
  })
})

describe('output helpers', () => {
  let lines: string[]
  let log: MockInstance

  beforeEach(() => {
    lines = []
    log = vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
      lines.push(String(value ?? ''))
    })
  })

  afterEach(() => {
    log.mockRestore()
  })

  it('marks a pass, a failure and a warning distinctly', () => {
    pass('Node.js', 'v25.9.0')
    fail('Dev server', 'not running')
    warn('Checkpoints', 'none installed')
    expect(lines[0]).toContain('Node.js')
    expect(lines[0]).toContain('v25.9.0')
    expect(lines[1]).toContain('Dev server')
    expect(lines[2]).toContain('Checkpoints')
    expect(new Set(lines.map((l) => l.trim()[0])).size).toBe(3)
  })

  it('prefixes every instruction line so they read as one block', () => {
    info(['first', 'second'])
    expect(lines).toHaveLength(2)
    expect(lines.every((l) => l.includes('\u2503'))).toBe(true)
  })

  it('draws a box whose borders line up with its widest line', () => {
    box(['short', 'a much longer line'])
    const widths = lines.map((l) => displayWidth(l))
    expect(new Set(widths).size).toBe(1)
  })

  it('draws nothing for an empty box', () => {
    box([])
    expect(lines).toHaveLength(0)
  })

  it('keeps borders aligned when a line carries colour codes and emoji', () => {
    box(['plain', '\u001b[36m\ud83d\udc49 coloured\u001b[39m'])
    const widths = lines.map((l) => displayWidth(l))
    expect(new Set(widths).size).toBe(1)
  })
})
