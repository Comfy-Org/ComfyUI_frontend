import { beforeEach, describe, expect, it, vi } from 'vitest'
import { alert, box, displayWidth, fail, info, pass, warn } from './logger'

describe('displayWidth', () => {
  it('counts plain text by character', () => {
    expect(displayWidth('pnpm dev')).toBe(8)
  })

  it('ignores ANSI colour codes', () => {
    expect(displayWidth('[36mpnpm dev[39m')).toBe(8)
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

  beforeEach(() => {
    lines = []
    vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
      lines.push(String(value ?? ''))
    })
  })

  it('marks a pass, a failure and a warning distinctly', () => {
    pass('Node.js', 'v25.9.0')
    fail('Dev server', 'not running')
    warn('Checkpoints', 'none installed')
    expect(lines[0]).toContain('Node.js')
    expect(lines[0]).toContain('v25.9.0')
    expect(lines[1]).toContain('Dev server')
    expect(lines[2]).toContain('Checkpoints')

    // Asserted by marker rather than by leading character: picocolors emits
    // escapes only when the run has colour, so the first character differs
    // between a local terminal and CI.
    expect(lines[0]).toContain('✅')
    expect(lines[1]).toContain('❌')
    expect(lines[2]).toContain('⚠️')
  })

  it('prefixes every instruction line so they read as one block', () => {
    info(['first', 'second'])
    expect(lines).toHaveLength(2)
    expect(lines.every((l) => l.includes('┃'))).toBe(true)
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
    box(['plain', '[36m👉 coloured[39m'])
    const widths = lines.map((l) => displayWidth(l))
    expect(new Set(widths).size).toBe(1)
  })
})

describe('alert', () => {
  let lines: string[]

  beforeEach(() => {
    lines = []
    vi.spyOn(console, 'log').mockImplementation((value?: unknown) => {
      lines.push(String(value ?? ''))
    })
  })

  it('renders distinctly from a plain warn — bordered, not one line', () => {
    alert('Backend is not multi-user', ['fix it like this'])
    const bordered = lines.filter((l) => l.includes('┃'))
    expect(bordered.length).toBeGreaterThan(1)
    expect(lines.some((l) => l.includes('Backend is not multi-user'))).toBe(
      true
    )
    expect(lines.some((l) => l.includes('fix it like this'))).toBe(true)
  })

  it('keeps the border aligned with its longest line', () => {
    alert('short', ['a much longer instruction line than the title'])
    const bordered = lines.filter((l) => l.includes('┃'))
    const widths = bordered.map((l) => displayWidth(l))
    expect(new Set(widths).size).toBe(1)
  })
})
