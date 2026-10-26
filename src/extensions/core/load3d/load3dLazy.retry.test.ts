import { fromAny } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { load3dLazyExtension } from '@/extensions/core/load3d/load3dLazy'
import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import { reportError } from '@/platform/telemetry/reportError'
import { app } from '@/scripts/app'
import { useExtensionStore } from '@/stores/extensionStore'

const { lazyModules, lightInfoImport } = vi.hoisted(() => {
  const defineExtension = (name: string) => ({
    name,
    nodeCreated: vi.fn()
  })
  return {
    lightInfoImport: { failuresRemaining: 0 },
    lazyModules: {
      load3d: {
        load3dExtension: defineExtension('Comfy.Load3D'),
        preview3DExtension: defineExtension('Comfy.Preview3D'),
        preview3DAdvancedExtension: defineExtension('Comfy.Preview3DAdvanced'),
        save3DAdvancedExtension: defineExtension('Comfy.Save3DAdvanced')
      },
      load3dAdvanced: {
        load3dAdvancedExtension: defineExtension('Comfy.Load3DAdvanced')
      },
      load3dPreviewExtensions: {
        previewGaussianSplatExtension: defineExtension(
          'Comfy.PreviewGaussianSplat'
        ),
        previewPointCloudExtension: defineExtension('Comfy.PreviewPointCloud'),
        saveGaussianSplatExtension: defineExtension('Comfy.SaveGaussianSplat'),
        savePointCloudExtension: defineExtension('Comfy.SavePointCloud')
      },
      saveMesh: { saveMeshExtension: defineExtension('Comfy.SaveGLB') },
      cameraInfo: {
        cameraInfoExtension: defineExtension('Comfy.CreateCameraInfo')
      },
      cameraAngle: {
        cameraAngleExtension: defineExtension('Comfy.CameraAngle')
      },
      lightInfo: {
        lightInfoExtension: defineExtension('Comfy.CreateLightInfo')
      }
    }
  }
})

vi.mock(import('@/scripts/app'), () => ({
  app: fromAny({ __mockApp: true })
}))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/extensions/core/load3d/load3d'), () => lazyModules.load3d)
vi.mock(
  import('@/extensions/core/load3d/load3dAdvanced'),
  () => lazyModules.load3dAdvanced
)
vi.mock(
  import('@/extensions/core/load3d/load3dPreviewExtensions'),
  () => lazyModules.load3dPreviewExtensions
)
vi.mock(import('@/extensions/core/load3d/saveMesh'), () => lazyModules.saveMesh)
vi.mock(
  import('@/extensions/core/load3d/cameraInfo'),
  () => lazyModules.cameraInfo
)
vi.mock(
  import('@/extensions/core/load3d/cameraAngle'),
  () => lazyModules.cameraAngle
)
vi.mock(import('@/extensions/core/load3d/lightInfo'), () => {
  if (lightInfoImport.failuresRemaining > 0) {
    lightInfoImport.failuresRemaining--
    throw new TypeError('Failed to fetch dynamically imported module')
  }
  return lazyModules.lightInfo
})

const lazyExtensions = Object.values(lazyModules).flatMap((module) =>
  Object.values(module)
)

function createNode(id: number, comfyClass: string) {
  const node = fromAny<LGraphNode, unknown>({ id, constructor: { comfyClass } })
  return load3dLazyExtension.nodeCreated!(node, app)
}

const replayedNodes = () =>
  lazyExtensions.map(({ nodeCreated }) => nodeCreated.mock.calls)

describe('load3dLazy after a failed lazy import', () => {
  it('registers nothing, reports the failure once, and retries the import on the next 3D node', async () => {
    const extensionStore = useExtensionStore()
    const registeredNames = () =>
      extensionStore.extensions.map(({ name }) => name)
    lightInfoImport.failuresRemaining = 1

    await expect(createNode(1, 'Load3D')).resolves.toBeUndefined()

    expect(registeredNames()).toEqual([])
    expect(replayedNodes()).toEqual(lazyExtensions.map(() => []))
    expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
      errorType: 'error_loading_3d_extensions',
      surface: 'graph'
    })

    await createNode(2, 'Preview3D')

    expect(registeredNames()).toEqual(lazyExtensions.map(({ name }) => name))
    expect(replayedNodes()).toEqual(
      lazyExtensions.map(() => [[expect.objectContaining({ id: 2 }), app]])
    )
    expect(reportError).toHaveBeenCalledOnce()
  })
})
