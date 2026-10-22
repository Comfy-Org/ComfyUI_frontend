import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { reportError } from '@/platform/telemetry/reportError'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'
import type { useExtensionService } from '@/services/extensionService'
import { useExtensionStore } from '@/stores/extensionStore'
import type { ComfyExtension } from '@/types/comfy'

const { registerExtensionMock, evaluateLightInfo } = vi.hoisted(() => ({
  registerExtensionMock: vi.fn(),
  evaluateLightInfo: vi.fn()
}))

vi.mock(import('@/services/extensionService'), () => ({
  useExtensionService: () =>
    fromPartial<ReturnType<typeof useExtensionService>>({
      registerExtension: registerExtensionMock
    })
}))
vi.mock(import('@/scripts/app'), () => ({
  app: fromAny({ __mockApp: true })
}))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/extensions/core/load3d/load3d'), () => ({}))
vi.mock(import('@/extensions/core/load3d/load3dAdvanced'), () => ({}))
vi.mock(import('@/extensions/core/load3d/load3dPreviewExtensions'), () => ({}))
vi.mock(import('@/extensions/core/load3d/saveMesh'), () => ({}))
vi.mock(import('@/extensions/core/load3d/cameraInfo'), () => ({}))
vi.mock(import('@/extensions/core/load3d/cameraAngle'), () => ({}))
vi.mock(import('@/extensions/core/load3d/lightInfo'), () => {
  evaluateLightInfo()
  return {}
})

await import('@/extensions/core/load3d/load3dLazy')
const lazyExtension: ComfyExtension = registerExtensionMock.mock.calls[0][0]

function registerNodeDef(id: number, name: string) {
  const nodeData = fromPartial<ComfyNodeDef>({ name })
  const nodeType = fromAny<typeof LGraphNode, unknown>({ id })
  return lazyExtension.beforeRegisterNodeDef!(nodeType, nodeData, fromAny({}))
}

describe('load3dLazy after a failed lazy import', () => {
  it('reports the failure once and retries the import on the next 3D node', async () => {
    const replayed = vi.fn()
    vi.spyOn(useExtensionStore(), 'enabledExtensions', 'get')
      .mockReturnValueOnce([])
      .mockReturnValueOnce([])
      .mockReturnValue([{ name: 'Inner', beforeRegisterNodeDef: replayed }])
    evaluateLightInfo.mockImplementationOnce(() => {
      throw new TypeError('Failed to fetch dynamically imported module')
    })

    await expect(registerNodeDef(1, 'Load3D')).resolves.toBeUndefined()
    expect(replayed).not.toHaveBeenCalled()
    expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
      errorType: 'error_loading_3d_extensions',
      surface: 'graph'
    })

    await registerNodeDef(2, 'Preview3D')

    expect(replayed).toHaveBeenCalledExactlyOnceWith(
      { id: 2 },
      expect.objectContaining({ name: 'Preview3D' }),
      expect.objectContaining({ __mockApp: true })
    )
    expect(reportError).toHaveBeenCalledOnce()
  })
})
