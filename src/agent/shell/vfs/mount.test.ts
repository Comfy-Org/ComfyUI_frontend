import { describe, expect, it } from 'vitest'

import { MemoryVFS } from './memory'
import { MountedVFS } from './mount'

function setup() {
  const tmp = new MemoryVFS()
  const wf = new MemoryVFS()
  const fs = new MountedVFS({
    '/tmp': tmp,
    '/workflows': wf
  })
  return { fs, tmp, wf }
}

describe('MountedVFS', () => {
  it('list / shows mount roots', async () => {
    const { fs } = setup()
    const entries = await fs.list('/')
    expect(entries.map((e) => e.name).sort()).toEqual(['tmp', 'workflows'])
    expect(entries.every((e) => e.type === 'dir')).toBe(true)
  })

  it('dispatches read to correct mount', async () => {
    const { fs, tmp } = setup()
    await tmp.write('/a.txt', 'hello')
    expect(await fs.read('/tmp/a.txt')).toBe('hello')
  })

  it('write routes to mount and list reflects prefix', async () => {
    const { fs } = setup()
    await fs.write('/workflows/foo.json', '{}')
    const entries = await fs.list('/workflows')
    expect(entries.map((e) => e.name)).toEqual(['foo.json'])
    expect(entries[0].path).toBe('/workflows/foo.json')
  })

  it('move within same mount', async () => {
    const { fs } = setup()
    await fs.write('/tmp/a', 'x')
    await fs.move('/tmp/a', '/tmp/b')
    expect(await fs.exists('/tmp/a')).toBe(false)
    expect(await fs.read('/tmp/b')).toBe('x')
  })

  it('move across mounts copies + deletes', async () => {
    const { fs } = setup()
    await fs.write('/tmp/a', 'x')
    await fs.move('/tmp/a', '/workflows/a')
    expect(await fs.exists('/tmp/a')).toBe(false)
    expect(await fs.read('/workflows/a')).toBe('x')
  })

  it('throws on unmounted path', async () => {
    const { fs } = setup()
    await expect(fs.read('/unknown/x')).rejects.toThrow(/no mount/)
  })

  it('exists returns false for unmounted', async () => {
    const { fs } = setup()
    expect(await fs.exists('/unknown/x')).toBe(false)
  })

  it('normalizes .. in paths', async () => {
    const { fs } = setup()
    await fs.write('/tmp/a', 'x')
    expect(await fs.read('/tmp/sub/../a')).toBe('x')
  })
})
