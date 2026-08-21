import { describe, expect, it } from 'vitest'
import { parseFlags } from './flags'

describe('parseFlags', () => {
  it('separates positional arguments from flags', () => {
    const { positional, flags } = parseFlags(['a.ts', '--name', 'thing'])
    expect(positional).toEqual(['a.ts'])
    expect(flags.name).toBe('thing')
  })

  it('accepts --key=value', () => {
    expect(parseFlags(['--workflow=default']).flags.workflow).toBe('default')
  })

  it('treats a trailing flag with no value as empty, not as the next flag', () => {
    const { flags } = parseFlags(['--tags', '--name', 'x'])
    expect(flags.tags).toBe('')
    expect(flags.name).toBe('x')
  })

  it('keeps a value that contains an equals sign intact', () => {
    expect(parseFlags(['--output=a=b.ts']).flags.output).toBe('a=b.ts')
  })
})
