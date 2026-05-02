import { describe, expect, it } from 'vitest'

import { MemoryVFS } from './memory'

describe('MemoryVFS', () => {
  it('write + read roundtrip', async () => {
    const fs = new MemoryVFS()
    await fs.write('/a.txt', 'hello')
    expect(await fs.read('/a.txt')).toBe('hello')
  })

  it('list direct children', async () => {
    const fs = new MemoryVFS()
    await fs.write('/dir/a.txt', '1')
    await fs.write('/dir/b.txt', '2')
    await fs.write('/dir/sub/c.txt', '3')
    const entries = await fs.list('/dir')
    expect(entries.map((e) => e.name)).toEqual(['a.txt', 'b.txt', 'sub'])
    expect(entries.find((e) => e.name === 'sub')?.type).toBe('dir')
    expect(entries.find((e) => e.name === 'a.txt')?.type).toBe('file')
  })

  it('list root', async () => {
    const fs = new MemoryVFS()
    await fs.write('/foo.txt', 'x')
    const entries = await fs.list('/')
    expect(entries.map((e) => e.name)).toEqual(['foo.txt'])
  })

  it('append', async () => {
    const fs = new MemoryVFS()
    await fs.append('/log', 'a\n')
    await fs.append('/log', 'b\n')
    expect(await fs.read('/log')).toBe('a\nb\n')
  })

  it('move', async () => {
    const fs = new MemoryVFS()
    await fs.write('/from', 'data')
    await fs.move('/from', '/to')
    expect(await fs.exists('/from')).toBe(false)
    expect(await fs.read('/to')).toBe('data')
  })

  it('delete', async () => {
    const fs = new MemoryVFS()
    await fs.write('/a', 'x')
    await fs.delete('/a')
    expect(await fs.exists('/a')).toBe(false)
  })

  it('normalizes . and ..', async () => {
    const fs = new MemoryVFS()
    await fs.write('/a/b/../c.txt', 'v')
    expect(await fs.read('/a/c.txt')).toBe('v')
  })

  it('throws on missing file', async () => {
    const fs = new MemoryVFS()
    await expect(fs.read('/nope')).rejects.toThrow(/no such/)
  })

  it('throws listing nonexistent dir', async () => {
    const fs = new MemoryVFS()
    await expect(fs.list('/nope')).rejects.toThrow(/no such/)
  })

  it('exists returns true for dir prefixes', async () => {
    const fs = new MemoryVFS()
    await fs.write('/dir/a', '1')
    expect(await fs.exists('/dir')).toBe(true)
  })
})
