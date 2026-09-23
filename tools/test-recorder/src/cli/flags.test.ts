import { describe, expect, it } from 'vitest'
import { parseFlags, parseTags } from './flags'

describe('parseFlags', () => {
  it('separates positional arguments from flags', () => {
    const { positional, flags } = parseFlags(
      ['a.ts', '--name', 'thing'],
      ['name']
    )
    expect(positional).toEqual(['a.ts'])
    expect(flags.name).toBe('thing')
  })

  it('accepts --key=value', () => {
    expect(parseFlags(['--workflow=default']).flags.workflow).toBe('default')
  })

  it('treats a trailing flag with no value as empty, not as the next flag', () => {
    const { flags } = parseFlags(['--tags', '--name', 'x'], ['tags', 'name'])
    expect(flags.tags).toBe('')
    expect(flags.name).toBe('x')
  })

  it('leaves a positional alone after a flag that takes no value', () => {
    const { positional, flags } = parseFlags(['--dry-run', 'a.ts'], ['name'])
    expect(flags['dry-run']).toBe('')
    expect(positional).toEqual(['a.ts'])
  })

  it('keeps a value that contains an equals sign intact', () => {
    expect(parseFlags(['--output=a=b.ts']).flags.output).toBe('a=b.ts')
  })

  it('returns empty positional and flags collections for no arguments', () => {
    expect(parseFlags([])).toEqual({ positional: [], flags: {} })
  })
})

describe('parseTags', () => {
  it('trims whitespace around each comma-separated tag', () => {
    expect(parseTags('@canvas, @widget ,@smoke')).toEqual([
      '@canvas',
      '@widget',
      '@smoke'
    ])
  })

  it('drops empty entries from trailing or doubled commas', () => {
    expect(parseTags('@canvas,,@widget,')).toEqual(['@canvas', '@widget'])
  })

  it('returns undefined for an undefined value', () => {
    expect(parseTags(undefined)).toBeUndefined()
  })

  it('returns undefined when nothing survives filtering', () => {
    expect(parseTags(' , , ')).toBeUndefined()
  })
})
