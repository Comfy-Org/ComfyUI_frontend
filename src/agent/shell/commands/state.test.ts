import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/scripts/api', () => {
  class FakeApi extends EventTarget {
    listUserDataFullInfo = vi.fn()
    getUserData = vi.fn()
    storeUserData = vi.fn()
    deleteUserData = vi.fn()
    moveUserData = vi.fn()
    fetchApi = vi.fn()
    init = vi.fn()
  }
  return { api: new FakeApi() }
})

vi.mock('@/platform/workflow/management/stores/workflowStore', () => ({
  useWorkflowStore: () => ({ activeWorkflow: null })
}))

const openPanel = vi.fn()
vi.mock('@/stores/workspace/rightSidePanelStore', () => ({
  useRightSidePanelStore: () => ({ openPanel })
}))

import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'

import { CommandRegistryImpl } from '../runtime'
import type { CmdContext } from '../types'
import { collect, emptyIter } from '../types'
import { MemoryVFS } from '../vfs/memory'
import { registerStateCommands } from './state'

function baseCtx(argv: string[]): CmdContext {
  return {
    argv,
    stdin: emptyIter(),
    env: new Map(),
    cwd: '/',
    vfs: new MemoryVFS(),
    signal: new AbortController().signal
  }
}

describe('state commands', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('missing-models reports 0 when none', async () => {
    const r = new CommandRegistryImpl()
    registerStateCommands(r)
    const cmd = r.get('missing-models')!
    const res = await cmd(baseCtx(['missing-models']))
    expect(await collect(res.stdout)).toContain('0 missing')
  })

  it('missing-models lists candidates from the store', async () => {
    const store = useMissingModelStore()
    store.setMissingModels([
      {
        nodeId: 5,
        nodeType: 'CheckpointLoaderSimple',
        widgetName: 'ckpt_name',
        isAssetSupported: false,
        name: 'v1-5-pruned.safetensors',
        directory: 'checkpoints',
        isMissing: true
      }
    ])
    const r = new CommandRegistryImpl()
    registerStateCommands(r)
    const res = await r.get('missing-models')!(baseCtx(['missing-models']))
    const out = await collect(res.stdout)
    expect(out).toContain('MISSING')
    expect(out).toContain('v1-5-pruned.safetensors')
    expect(out).toContain('checkpoints')
    expect(out).toContain('CheckpointLoaderSimple')
  })

  it('workflow-errors reports "no errors" when clean', async () => {
    const r = new CommandRegistryImpl()
    registerStateCommands(r)
    const res = await r.get('workflow-errors')!(baseCtx(['workflow-errors']))
    expect(await collect(res.stdout)).toContain('no errors')
  })

  it('workflow-errors counts missing models', async () => {
    const store = useMissingModelStore()
    store.setMissingModels([
      {
        nodeType: 'X',
        widgetName: 'w',
        isAssetSupported: false,
        name: 'a',
        isMissing: true
      }
    ])
    const r = new CommandRegistryImpl()
    registerStateCommands(r)
    const res = await r.get('workflow-errors')!(baseCtx(['workflow-errors']))
    expect(await collect(res.stdout)).toContain('missing models: 1')
  })

  it('help emits command overview', async () => {
    const r = new CommandRegistryImpl()
    registerStateCommands(r)
    const res = await r.get('help')!(baseCtx(['help']))
    const out = await collect(res.stdout)
    expect(out).toContain('coreutils')
    expect(out).toContain('missing-models')
    expect(out).toContain('Mounts')
  })

  it('show-errors opens right-side errors panel', async () => {
    openPanel.mockClear()
    const r = new CommandRegistryImpl()
    registerStateCommands(r)
    const res = await r.get('show-errors')!(baseCtx(['show-errors']))
    expect(res.exitCode).toBe(0)
    expect(openPanel).toHaveBeenCalledWith('errors')
  })

  it('show-missing-models does nothing when count is 0', async () => {
    openPanel.mockClear()
    const r = new CommandRegistryImpl()
    registerStateCommands(r)
    const res = await r.get('show-missing-models')!(
      baseCtx(['show-missing-models'])
    )
    expect(res.exitCode).toBe(0)
    expect(res.stderr).toContain('no missing')
    expect(openPanel).not.toHaveBeenCalled()
  })

  it('show-missing-models opens panel when missing models exist', async () => {
    openPanel.mockClear()
    const store = useMissingModelStore()
    store.setMissingModels([
      {
        nodeType: 'X',
        widgetName: 'w',
        isAssetSupported: false,
        name: 'a',
        isMissing: true
      }
    ])
    const r = new CommandRegistryImpl()
    registerStateCommands(r)
    const res = await r.get('show-missing-models')!(
      baseCtx(['show-missing-models'])
    )
    expect(res.exitCode).toBe(0)
    expect(openPanel).toHaveBeenCalledWith('errors')
  })
})
