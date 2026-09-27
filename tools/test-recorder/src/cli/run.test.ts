import { describe, expect, it } from 'vitest'
import { needsShell, quoteForCmd, runCommand } from './run'

describe('needsShell', () => {
  it('routes through a shell on Windows, where pnpm is a .cmd', () => {
    expect(needsShell('win32')).toBe(true)
  })

  it('execs directly on macOS and Linux', () => {
    expect(needsShell('darwin')).toBe(false)
    expect(needsShell('linux')).toBe(false)
  })
})

describe('runCommand', () => {
  it('runs a command and returns its output', () => {
    const result = runCommand('node', ['-e', 'process.stdout.write("hi")'])
    expect(result.status).toBe(0)
    expect(result.stdout.toString()).toBe('hi')
  })

  it('lets an explicit shell option override the platform default', () => {
    const result = runCommand('node', ['-e', 'process.exit(3)'], {
      shell: false
    })
    expect(result.status).toBe(3)
  })
})

describe('quoteForCmd', () => {
  it('leaves an ordinary argument untouched', () => {
    expect(quoteForCmd('install')).toBe('install')
  })

  it('quotes a path containing spaces so it stays one argument', () => {
    expect(quoteForCmd(String.raw`C:\dev\my repo\a.ts`)).toBe(
      String.raw`"C:\dev\my repo\a.ts"`
    )
  })

  it('quotes cmd.exe metacharacters rather than letting them run', () => {
    expect(quoteForCmd(String.raw`C:\dev\R&D`)).toBe(String.raw`"C:\dev\R&D"`)
    expect(quoteForCmd('a|b')).toBe('"a|b"')
  })

  it('represents an empty argument explicitly', () => {
    expect(quoteForCmd('')).toBe('""')
  })

  it('escapes an embedded quote so it cannot close the argument', () => {
    expect(quoteForCmd('say "hi"')).toBe(String.raw`"say \"hi\""`)
  })
})
