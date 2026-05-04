import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { ComfyExtension } from '@/types/comfy'

const { registerExtensionMock, enabledExtensionsGetter } = vi.hoisted(() => ({
  registerExtensionMock: vi.fn(),
  enabledExtensionsGetter: vi.fn(() => [] as ComfyExtension[])
}))

vi.mock('@/services/extensionService', () => ({
  useExtensionService: () => ({ registerExtension: registerExtensionMock })
}))

vi.mock('@/stores/extensionStore', () => ({
  useExtensionStore: () => ({
    get enabledExtensions() {
      return enabledExtensionsGetter()
    }
  })
}))

vi.mock('@/scripts/app', () => ({
  app: { __mockApp: true }
}))

vi.mock('@/extensions/core/load3d', () => ({}))
vi.mock('@/extensions/core/saveMesh', () => ({}))

type Hook = (
  nodeType: typeof LGraphNode,
  nodeData: ComfyNodeDef,
  app?: unknown
) => Promise<void> | void

async function loadLazyExtensionFresh(): Promise<{ hook: Hook }> {
  vi.resetModules()
  registerExtensionMock.mockClear()
  enabledExtensionsGetter.mockReset().mockReturnValue([])
  await import('@/extensions/core/load3dLazy')
  const ext = registerExtensionMock.mock.calls[0][0] as ComfyExtension
  return { hook: ext.beforeRegisterNodeDef as Hook }
}

function makeNodeDef(
  name: string,
  extra: Partial<ComfyNodeDef> = {}
): ComfyNodeDef {
  return {
    name,
    display_name: name,
    category: '',
    output: [],
    output_is_list: [],
    output_name: [],
    python_module: '',
    description: '',
    ...extra
  } as ComfyNodeDef
}

describe('load3dLazy', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('registers a single Comfy.Load3DLazy extension on import', async () => {
    await loadLazyExtensionFresh()

    expect(registerExtensionMock).toHaveBeenCalledOnce()
    const ext = registerExtensionMock.mock.calls[0][0] as ComfyExtension
    expect(ext.name).toBe('Comfy.Load3DLazy')
    expect(typeof ext.beforeRegisterNodeDef).toBe('function')
  })

  it('skips loading and mutation for non-3D node defs', async () => {
    const { hook } = await loadLazyExtensionFresh()

    await hook({} as typeof LGraphNode, makeNodeDef('PlainNode'))

    // No diff was ever computed because the early-return branch was taken.
    expect(enabledExtensionsGetter).not.toHaveBeenCalled()
  })

  it.each(['Load3D', 'Preview3D', 'SaveGLB'])(
    'recognizes %s as a 3D node type and triggers the lazy-load path',
    async (nodeType) => {
      const { hook } = await loadLazyExtensionFresh()

      await hook({} as typeof LGraphNode, makeNodeDef(nodeType))

      // The lazy-load path always reads enabledExtensions once for the diff.
      expect(enabledExtensionsGetter).toHaveBeenCalled()
    }
  )

  it('injects mesh_upload spec flags into the model_file widget for Load3D nodes', async () => {
    const { hook } = await loadLazyExtensionFresh()
    const nodeData = makeNodeDef('Load3D', {
      input: {
        required: { model_file: ['STRING', {}] }
      }
    } as Partial<ComfyNodeDef>)

    await hook({} as typeof LGraphNode, nodeData)

    const spec = (
      nodeData.input!.required!.model_file as [string, Record<string, unknown>]
    )[1]
    expect(spec.mesh_upload).toBe(true)
    expect(spec.upload_subfolder).toBe('3d')
  })

  it('does not throw when a Load3D node has no model_file widget spec', async () => {
    const { hook } = await loadLazyExtensionFresh()
    const nodeData = makeNodeDef('Load3D', {
      input: { required: {} }
    } as Partial<ComfyNodeDef>)

    await expect(
      hook({} as typeof LGraphNode, nodeData)
    ).resolves.toBeUndefined()
  })

  it('does not mutate model_file for non-Load3D 3D node types', async () => {
    const { hook } = await loadLazyExtensionFresh()
    const nodeData = makeNodeDef('Preview3D', {
      input: {
        required: { model_file: ['STRING', { existing: true }] }
      }
    } as Partial<ComfyNodeDef>)

    await hook({} as typeof LGraphNode, nodeData)

    const spec = (
      nodeData.input!.required!.model_file as [string, Record<string, unknown>]
    )[1]
    expect(spec.mesh_upload).toBeUndefined()
  })

  it('replays beforeRegisterNodeDef of newly registered extensions, passing the app reference', async () => {
    const newExtension: ComfyExtension = {
      name: 'Inner',
      beforeRegisterNodeDef: vi.fn()
    }
    // First call (snapshotting `before`) sees an empty list; second call
    // (computing the diff after dynamic imports) sees the new extension.
    enabledExtensionsGetter
      .mockReturnValueOnce([])
      .mockReturnValueOnce([newExtension])
    const { hook } = await loadLazyExtensionFresh()
    enabledExtensionsGetter
      .mockReturnValueOnce([])
      .mockReturnValueOnce([newExtension])

    const nodeData = makeNodeDef('Preview3D')
    await hook({ id: 1 } as unknown as typeof LGraphNode, nodeData)

    expect(newExtension.beforeRegisterNodeDef).toHaveBeenCalledWith(
      { id: 1 },
      nodeData,
      expect.objectContaining({ __mockApp: true })
    )
  })

  it('does not replay extensions that were already registered before lazy loading', async () => {
    const preexisting: ComfyExtension = {
      name: 'PreExisting',
      beforeRegisterNodeDef: vi.fn()
    }
    enabledExtensionsGetter.mockReturnValue([preexisting])
    const { hook } = await loadLazyExtensionFresh()
    enabledExtensionsGetter.mockReturnValue([preexisting])

    await hook({} as typeof LGraphNode, makeNodeDef('Load3D'))

    expect(preexisting.beforeRegisterNodeDef).not.toHaveBeenCalled()
  })
})
