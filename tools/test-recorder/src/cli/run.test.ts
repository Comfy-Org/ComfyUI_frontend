import { describe, expect, it } from 'vitest'
import { needsShell, runCommand } from './run'

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
