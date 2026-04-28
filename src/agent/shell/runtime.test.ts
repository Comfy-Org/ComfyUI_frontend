import { describe, expect, it } from 'vitest'

import { CommandRegistryImpl, runScript } from './runtime'
import type { ExecContext } from './runtime'
import { collect, emptyIter, lines, stringIter } from './types'
import type { Command } from './types'
import { MemoryVFS } from './vfs/memory'

function setup(): ExecContext & { registry: CommandRegistryImpl } {
  const registry = new CommandRegistryImpl()
  const echo: Command = async (ctx) => ({
    stdout: stringIter(ctx.argv.slice(1).join(' ') + '\n'),
    exitCode: 0
  })
  const cat: Command = async (ctx) => ({ stdout: ctx.stdin, exitCode: 0 })
  const grep: Command = async (ctx) => {
    const re = new RegExp(ctx.argv[1])
    async function* gen(): AsyncIterable<string> {
      for await (const l of lines(ctx.stdin)) {
        if (re.test(l)) yield l + '\n'
      }
    }
    return { stdout: gen(), exitCode: 0 }
  }
  const fail: Command = async () => ({ stdout: emptyIter(), exitCode: 2 })
  const count: Command = async (ctx) => {
    let n = 0
    for await (const _l of lines(ctx.stdin)) n++
    return { stdout: stringIter(String(n) + '\n'), exitCode: 0 }
  }
  const boom: Command = async () => {
    throw new Error('kaboom')
  }
  registry.register('echo', echo)
  registry.register('cat', cat)
  registry.register('grep', grep)
  registry.register('fail', fail)
  registry.register('count', count)
  registry.register('boom', boom)
  return {
    registry,
    vfs: new MemoryVFS(),
    env: new Map(),
    cwd: '/'
  }
}

describe('runScript', () => {
  it('runs simple command', async () => {
    const ctx = setup()
    const r = await runScript('echo hi', ctx)
    expect(r.exitCode).toBe(0)
    expect(await collect(r.stdout)).toBe('hi\n')
  })

  it('pipes through stages', async () => {
    const ctx = setup()
    const r = await runScript('echo a | cat | cat', ctx)
    expect(await collect(r.stdout)).toBe('a\n')
  })

  it('grep filters piped input', async () => {
    const ctx = setup()
    const r = await runScript('echo foo | grep oo', ctx)
    expect(await collect(r.stdout)).toBe('foo\n')
    const r2 = await runScript('echo bar | grep oo', ctx)
    expect(await collect(r2.stdout)).toBe('')
  })

  it('&& short-circuits on failure', async () => {
    const ctx = setup()
    const r = await runScript('fail && echo nope', ctx)
    expect(r.exitCode).toBe(2)
    expect(await collect(r.stdout)).toBe('')
  })

  it('&& runs right on success', async () => {
    const ctx = setup()
    const r = await runScript('echo a && echo b', ctx)
    expect(r.exitCode).toBe(0)
    expect(await collect(r.stdout)).toBe('a\nb\n')
  })

  it('|| runs right on failure', async () => {
    const ctx = setup()
    const r = await runScript('fail || echo recover', ctx)
    expect(r.exitCode).toBe(0)
    expect(await collect(r.stdout)).toContain('recover')
  })

  it('redirect > writes stdout to vfs', async () => {
    const ctx = setup()
    const r = await runScript('echo hello > /out.txt', ctx)
    expect(r.exitCode).toBe(0)
    expect(await collect(r.stdout)).toBe('')
    expect(await ctx.vfs.read('/out.txt')).toBe('hello\n')
  })

  it('redirect >> appends', async () => {
    const ctx = setup()
    await runScript('echo a >> /log', ctx)
    await runScript('echo b >> /log', ctx)
    expect(await ctx.vfs.read('/log')).toBe('a\nb\n')
  })

  it('pipe redirect writes final stage output', async () => {
    const ctx = setup()
    await runScript('echo foo | cat > /p.txt', ctx)
    expect(await ctx.vfs.read('/p.txt')).toBe('foo\n')
  })

  it('unknown command returns 127', async () => {
    const ctx = setup()
    const r = await runScript('notreal', ctx)
    expect(r.exitCode).toBe(127)
    expect(r.stderr).toContain('not found')
  })

  it('throwing command returns 1', async () => {
    const ctx = setup()
    const r = await runScript('boom', ctx)
    expect(r.exitCode).toBe(1)
    expect(r.stderr).toContain('kaboom')
  })

  it('pre-aborted signal returns 130', async () => {
    const ctx = setup()
    const ac = new AbortController()
    ac.abort()
    const r = await runScript('echo hi', { ...ctx, signal: ac.signal })
    expect(r.exitCode).toBe(130)
  })

  it('seq runs both sides', async () => {
    const ctx = setup()
    const r = await runScript('echo a ; echo b', ctx)
    expect(await collect(r.stdout)).toBe('a\nb\n')
  })

  it('count consumes piped lines', async () => {
    const ctx = setup()
    const r = await runScript('echo a | count', ctx)
    expect(await collect(r.stdout)).toBe('1\n')
  })

  it('parse error returns exit 2', async () => {
    const ctx = setup()
    const r = await runScript('echo $(ls)', ctx)
    expect(r.exitCode).toBe(2)
  })
})
