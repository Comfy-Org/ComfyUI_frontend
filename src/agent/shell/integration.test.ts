import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/scripts/api', () => ({
  api: {
    listUserDataFullInfo: vi.fn(),
    getUserData: vi.fn(),
    storeUserData: vi.fn(),
    deleteUserData: vi.fn(),
    moveUserData: vi.fn()
  }
}))

import { api } from '@/scripts/api'
import { useCommandStore } from '@/stores/commandStore'

import { registerComfyCommands } from './commands/comfy'
import { registerCoreutils } from './commands/coreutils'
import { CommandRegistryImpl, runScript } from './runtime'
import { collect } from './types'
import { MemoryVFS } from './vfs/memory'
import { MountedVFS } from './vfs/mount'
import { UserdataVFS } from './vfs/userdata'

function setupRegistry() {
  const r = new CommandRegistryImpl()
  registerCoreutils(r)
  registerComfyCommands(r)
  return r
}

function setupVfs() {
  return new MountedVFS({
    '/tmp': new MemoryVFS(),
    '/workflows': new UserdataVFS('workflows')
  })
}

function ctx(registry = setupRegistry(), vfs = setupVfs()) {
  return {
    registry,
    vfs,
    env: new Map<string, string>(),
    cwd: '/',
    signal: new AbortController().signal
  }
}

describe('shell integration', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('lists mount roots at /', async () => {
    const r = await runScript('ls /', ctx())
    expect(r.exitCode).toBe(0)
    const out = await collect(r.stdout)
    expect(out).toContain('tmp')
    expect(out).toContain('workflows')
  })

  it('ls /workflows routes through userdata API', async () => {
    vi.mocked(api.listUserDataFullInfo).mockResolvedValue([
      { path: 'workflows/a.json', size: 10, modified: 1 },
      { path: 'workflows/b.json', size: 20, modified: 2 }
    ])
    const r = await runScript('ls /workflows', ctx())
    expect(r.exitCode).toBe(0)
    expect(await collect(r.stdout)).toBe('a.json\nb.json\n')
    expect(api.listUserDataFullInfo).toHaveBeenCalledWith('workflows')
  })

  it('cat /workflows/foo.json reads via userdata', async () => {
    vi.mocked(api.getUserData).mockResolvedValue(
      new Response('{"nodes":[]}', { status: 200 })
    )
    const r = await runScript('cat /workflows/foo.json', ctx())
    expect(r.exitCode).toBe(0)
    expect(await collect(r.stdout)).toBe('{"nodes":[]}')
    expect(api.getUserData).toHaveBeenCalledWith('workflows/foo.json')
  })

  it('pipeline: ls | grep filters userdata listing', async () => {
    vi.mocked(api.listUserDataFullInfo).mockResolvedValue([
      { path: 'workflows/cat.json', size: 1, modified: 1 },
      { path: 'workflows/dog.json', size: 1, modified: 1 }
    ])
    const r = await runScript('ls /workflows | grep cat', ctx())
    expect(await collect(r.stdout)).toBe('cat.json\n')
  })

  it('redirect > /tmp persists to memory mount', async () => {
    const c = ctx()
    await runScript('echo hello > /tmp/out.txt', c)
    const r2 = await runScript('cat /tmp/out.txt', c)
    expect(await collect(r2.stdout)).toBe('hello\n')
  })

  it('redirect > /workflows writes via userdata', async () => {
    vi.mocked(api.storeUserData).mockResolvedValue(
      new Response('', { status: 200 })
    )
    const r = await runScript('echo data > /workflows/new.json', ctx())
    expect(r.exitCode).toBe(0)
    expect(api.storeUserData).toHaveBeenCalledWith(
      'workflows/new.json',
      'data\n',
      expect.anything()
    )
  })

  it('&& short-circuits on ls failure', async () => {
    vi.mocked(api.listUserDataFullInfo).mockRejectedValue(new Error('boom'))
    const r = await runScript('ls /workflows && echo yes', ctx())
    expect(r.exitCode).toBe(1)
    expect(await collect(r.stdout)).not.toContain('yes')
  })

  it('cmd-list returns registered command ids', async () => {
    const store = useCommandStore()
    store.registerCommand({
      id: 'Comfy.Test.Foo',
      function: () => {},
      label: 'Foo'
    })
    store.registerCommand({
      id: 'Comfy.Test.Bar',
      function: () => {},
      label: 'Bar'
    })
    const r = await runScript('cmd-list Test', ctx())
    const out = await collect(r.stdout)
    expect(out).toContain('Comfy.Test.Foo')
    expect(out).toContain('Comfy.Test.Bar')
  })

  it('cmd invokes a registered command', async () => {
    const store = useCommandStore()
    const spy = vi.fn()
    store.registerCommand({
      id: 'Comfy.Test.Click',
      function: spy,
      label: 'Click'
    })
    const r = await runScript('cmd Comfy.Test.Click', ctx())
    expect(r.exitCode).toBe(0)
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('cmd returns 127 for unknown command', async () => {
    const r = await runScript('cmd Comfy.Nope', ctx())
    expect(r.exitCode).toBe(127)
    expect(r.stderr).toContain('unknown')
  })

  it('unknown mount path errors cleanly', async () => {
    const r = await runScript('ls /nowhere', ctx())
    expect(r.exitCode).toBe(1)
    expect(r.stderr).toMatch(/no mount/)
  })

  it('empty /workflows listing returns no output', async () => {
    vi.mocked(api.listUserDataFullInfo).mockResolvedValue([])
    const r = await runScript('ls /workflows', ctx())
    expect(r.exitCode).toBe(0)
    expect(await collect(r.stdout)).toBe('')
  })

  it('write then read roundtrip on /tmp via shell', async () => {
    const c = ctx()
    await runScript('echo line1 > /tmp/a ; echo line2 >> /tmp/a', c)
    const r = await runScript('cat /tmp/a | wc', c)
    expect(await collect(r.stdout)).toBe('2 2 12\n')
  })
})
