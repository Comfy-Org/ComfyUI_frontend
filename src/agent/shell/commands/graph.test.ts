import { beforeEach, describe, expect, it, vi } from 'vitest'

const canvasRef = { value: null as unknown }
vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({
    get canvas() {
      return canvasRef.value
    },
    set canvas(v: unknown) {
      canvasRef.value = v
    }
  })
}))

import { CommandRegistryImpl } from '../runtime'
import type { CmdContext } from '../types'
import { collect, emptyIter } from '../types'
import { MemoryVFS } from '../vfs/memory'
import { registerGraphCommands } from './graph'

function ctx(argv: string[]): CmdContext {
  return {
    argv,
    stdin: emptyIter(),
    env: new Map(),
    cwd: '/',
    vfs: new MemoryVFS(),
    signal: new AbortController().signal
  }
}

function setGraph(nodes: unknown[]) {
  canvasRef.value = { graph: { _nodes: nodes } }
}

describe('graph command', () => {
  beforeEach(() => {
    canvasRef.value = null
  })

  it('errors when no active graph', async () => {
    const r = new CommandRegistryImpl()
    registerGraphCommands(r)
    const res = await r.get('graph')!(ctx(['graph', 'summary']))
    expect(res.exitCode).toBe(1)
    expect(res.stderr).toContain('no active graph')
  })

  it('summary lists type counts', async () => {
    setGraph([
      { id: 1, comfyClass: 'KSampler' },
      { id: 2, comfyClass: 'KSampler' },
      { id: 3, comfyClass: 'CheckpointLoaderSimple' }
    ])
    const r = new CommandRegistryImpl()
    registerGraphCommands(r)
    const res = await r.get('graph')!(ctx(['graph', 'summary']))
    const out = await collect(res.stdout)
    expect(out).toContain('nodes: 3')
    expect(out).toContain('2\tKSampler')
    expect(out).toContain('1\tCheckpointLoaderSimple')
  })

  it('nodes with regex filters by type', async () => {
    setGraph([
      { id: 1, comfyClass: 'KSampler', title: 'main' },
      { id: 2, comfyClass: 'CLIPTextEncode' }
    ])
    const r = new CommandRegistryImpl()
    registerGraphCommands(r)
    const res = await r.get('graph')!(ctx(['graph', 'nodes', 'KSampler']))
    const out = await collect(res.stdout)
    expect(out).toContain('1\tKSampler\tmain')
    expect(out).not.toContain('CLIPTextEncode')
  })

  it('node <id> returns JSON summary', async () => {
    setGraph([
      {
        id: 5,
        comfyClass: 'KSampler',
        pos: [10, 20],
        widgets: [{ name: 'seed', value: 42, type: 'int' }],
        inputs: [{ name: 'model', type: 'MODEL', link: null }],
        outputs: [{ name: 'LATENT', type: 'LATENT', links: [1, 2] }]
      }
    ])
    const r = new CommandRegistryImpl()
    registerGraphCommands(r)
    const res = await r.get('graph')!(ctx(['graph', 'node', '5']))
    const out = await collect(res.stdout)
    const parsed = JSON.parse(out)
    expect(parsed.id).toBe(5)
    expect(parsed.type).toBe('KSampler')
    expect(parsed.widgets[0]).toEqual({ name: 'seed', value: 42, type: 'int' })
    expect(parsed.outputs[0].linkCount).toBe(2)
  })

  it('node <id> errors on missing node', async () => {
    setGraph([{ id: 1, comfyClass: 'X' }])
    const r = new CommandRegistryImpl()
    registerGraphCommands(r)
    const res = await r.get('graph')!(ctx(['graph', 'node', '99']))
    expect(res.exitCode).toBe(1)
    expect(res.stderr).toContain('no node 99')
  })

  it('set-widget mutates value and fires callback', async () => {
    const cb = vi.fn()
    setGraph([
      {
        id: 3,
        comfyClass: 'KSampler',
        widgets: [{ name: 'cfg', type: 'FLOAT', value: 8, callback: cb }]
      }
    ])
    const r = new CommandRegistryImpl()
    registerGraphCommands(r)
    const res = await r.get('set-widget')!(
      ctx(['set-widget', '3', 'cfg', '6.5'])
    )
    expect(res.exitCode).toBe(0)
    expect(cb).toHaveBeenCalledWith(6.5)
    expect(await collect(res.stdout)).toContain('6.5')
  })

  it('set-widget errors on missing widget', async () => {
    setGraph([{ id: 3, comfyClass: 'KSampler', widgets: [] }])
    const r = new CommandRegistryImpl()
    registerGraphCommands(r)
    const res = await r.get('set-widget')!(
      ctx(['set-widget', '3', 'nope', '1'])
    )
    expect(res.exitCode).toBe(1)
    expect(res.stderr).toContain('no widget')
  })
})
