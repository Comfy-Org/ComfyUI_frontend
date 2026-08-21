import { describe, expect, it } from 'vitest'
import { needsShell } from './run'

describe('needsShell', () => {
  it('routes through a shell on Windows, where pnpm is a .cmd', () => {
    expect(needsShell('win32')).toBe(true)
  })

  it('execs directly on macOS and Linux', () => {
    expect(needsShell('darwin')).toBe(false)
    expect(needsShell('linux')).toBe(false)
  })
})
