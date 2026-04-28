import { describe, expect, it } from 'vitest'

import { CommandRegistryImpl } from '../runtime'
import type { CmdContext } from '../types'
import { collect, emptyIter, stringIter } from '../types'
import { MemoryVFS } from '../vfs/memory'
import { coreutils, registerCoreutils } from './coreutils'

function baseCtx(
  argv: string[],
  stdin: AsyncIterable<string> = emptyIter(),
  vfs = new MemoryVFS()
): CmdContext {
  return {
    argv,
    stdin,
    env: new Map(),
    cwd: '/',
    vfs,
    signal: new AbortController().signal
  }
}

describe('coreutils', () => {
  it('echo joins args with space', async () => {
    const r = await coreutils.echo(baseCtx(['echo', 'hello', 'world']))
    expect(await collect(r.stdout)).toBe('hello world\n')
  })

  it('echo -n omits newline', async () => {
    const r = await coreutils.echo(baseCtx(['echo', '-n', 'hi']))
    expect(await collect(r.stdout)).toBe('hi')
  })

  it('cat reads file', async () => {
    const fs = new MemoryVFS()
    await fs.write('/f', 'contents')
    const r = await coreutils.cat(baseCtx(['cat', '/f'], emptyIter(), fs))
    expect(await collect(r.stdout)).toBe('contents')
  })

  it('cat passes through stdin with no args', async () => {
    const r = await coreutils.cat(baseCtx(['cat'], stringIter('passed\n')))
    expect(await collect(r.stdout)).toBe('passed\n')
  })

  it('ls lists sorted entries', async () => {
    const fs = new MemoryVFS()
    await fs.write('/b', '')
    await fs.write('/a', '')
    await fs.write('/sub/x', '')
    const r = await coreutils.ls(baseCtx(['ls', '/'], emptyIter(), fs))
    expect(await collect(r.stdout)).toBe('a\nb\nsub/\n')
  })

  it('pwd emits cwd', async () => {
    const r = await coreutils.pwd(baseCtx(['pwd']))
    expect(await collect(r.stdout)).toBe('/\n')
  })

  it('wc counts lines, words, bytes', async () => {
    const r = await coreutils.wc(baseCtx(['wc'], stringIter('a\nb\nc\n')))
    expect(await collect(r.stdout)).toBe('3 3 6\n')
  })

  it('head -n 2 keeps first 2', async () => {
    const r = await coreutils.head(
      baseCtx(['head', '-n', '2'], stringIter('1\n2\n3\n4\n'))
    )
    expect(await collect(r.stdout)).toBe('1\n2\n')
  })

  it('tail -n 2 keeps last 2', async () => {
    const r = await coreutils.tail(
      baseCtx(['tail', '-n', '2'], stringIter('1\n2\n3\n4\n'))
    )
    expect(await collect(r.stdout)).toBe('3\n4\n')
  })

  it('grep filters', async () => {
    const r = await coreutils.grep(
      baseCtx(['grep', 'foo'], stringIter('foo\nbar\nfood\n'))
    )
    expect(await collect(r.stdout)).toBe('foo\nfood\n')
  })

  it('true exits 0, false exits 1', async () => {
    expect((await coreutils.true(baseCtx(['true']))).exitCode).toBe(0)
    expect((await coreutils.false(baseCtx(['false']))).exitCode).toBe(1)
  })

  it('seq N counts 1..N inclusive', async () => {
    const r = await coreutils.seq(baseCtx(['seq', '3']))
    expect(await collect(r.stdout)).toBe('1\n2\n3\n')
  })

  it('seq A B counts A..B inclusive', async () => {
    const r = await coreutils.seq(baseCtx(['seq', '5', '8']))
    expect(await collect(r.stdout)).toBe('5\n6\n7\n8\n')
  })

  it('seq A STEP B supports custom step', async () => {
    const r = await coreutils.seq(baseCtx(['seq', '10', '5', '25']))
    expect(await collect(r.stdout)).toBe('10\n15\n20\n25\n')
  })

  it('seq supports negative step', async () => {
    const r = await coreutils.seq(baseCtx(['seq', '3', '-1', '1']))
    expect(await collect(r.stdout)).toBe('3\n2\n1\n')
  })

  it('registerCoreutils registers all commands', () => {
    const reg = new CommandRegistryImpl()
    registerCoreutils(reg)
    expect(reg.list()).toEqual(
      [
        'cat',
        'echo',
        'false',
        'grep',
        'head',
        'ls',
        'pwd',
        'seq',
        'tail',
        'true',
        'wc'
      ].sort()
    )
  })
})
