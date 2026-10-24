import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

const lazyModules = vi.hoisted(() => {
  const defineExtension = (name: string) => ({
    name,
    beforeRegisterNodeDef: vi.fn()
  })
  return {
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
    cameraAngle: { cameraAngleExtension: defineExtension('Comfy.CameraAngle') },
    lightInfo: { lightInfoExtension: defineExtension('Comfy.CreateLightInfo') }
  }
})

vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/scripts/app'), () => ({
  app: fromAny({ __mockApp: true })
}))
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
vi.mock(
  import('@/extensions/core/load3d/lightInfo'),
  () => lazyModules.lightInfo
)

const lazyExtensions = Object.values(lazyModules).flatMap((module) =>
  Object.values(module)
)

const replayCalls = () =>
  lazyExtensions.map(
    ({ beforeRegisterNodeDef }) => vi.mocked(beforeRegisterNodeDef).mock.calls
  )

const LAZY_EXTENSION_REGISTRATION_ORDER = [
  'Comfy.Load3D',
  'Comfy.Preview3D',
  'Comfy.Preview3DAdvanced',
  'Comfy.Save3DAdvanced',
  'Comfy.Load3DAdvanced',
  'Comfy.PreviewGaussianSplat',
  'Comfy.PreviewPointCloud',
  'Comfy.SaveGaussianSplat',
  'Comfy.SavePointCloud',
  'Comfy.SaveGLB',
  'Comfy.CreateCameraInfo',
  'Comfy.CameraAngle',
  'Comfy.CreateLightInfo'
]

function nodeTypeWithId(id: number) {
  return fromAny<typeof LGraphNode, unknown>({ id })
}

function makeNodeDef(name: string, extra: Partial<ComfyNodeDef> = {}) {
  return fromPartial<ComfyNodeDef>({ name, ...extra })
}

function makeNodeDefWithModelFile(name: string) {
  const modelFileSpec: Record<string, unknown> = {}
  const nodeData = makeNodeDef(name, {
    input: fromPartial({ required: { model_file: ['STRING', modelFileSpec] } })
  })
  return { nodeData, modelFileSpec }
}

async function loadLazyExtensionFresh() {
  vi.resetModules()
  const { load3dLazyExtension } =
    await import('@/extensions/core/load3d/load3dLazy')
  const { useExtensionStore } = await import('@/stores/extensionStore')
  const { app } = await import('@/scripts/app')
  const { reportError } = await import('@/platform/telemetry/reportError')
  const extensionStore = useExtensionStore()
  return {
    app,
    reportError,
    extensionStore,
    registeredNames: () => extensionStore.extensions.map(({ name }) => name),
    registerNodeDef: (nodeType: typeof LGraphNode, nodeData: ComfyNodeDef) =>
      load3dLazyExtension.beforeRegisterNodeDef!(nodeType, nodeData, app)
  }
}

describe('load3dLazy', () => {
  it('registers and replays nothing for non-3D node defs', async () => {
    const { registeredNames, registerNodeDef } = await loadLazyExtensionFresh()

    await registerNodeDef(nodeTypeWithId(1), makeNodeDef('PlainNode'))

    expect(registeredNames()).toEqual([])
    expect(replayCalls()).toEqual(lazyExtensions.map(() => []))
  })

  it.for([
    'Load3D',
    'Preview3D',
    'PreviewGaussianSplat',
    'PreviewPointCloud',
    'SaveGLB',
    'Save3DAdvanced',
    'SaveGaussianSplat',
    'SavePointCloud'
  ])(
    'registers the lazy 3D extensions in order on the first %s node def',
    async (nodeName) => {
      const { registeredNames, registerNodeDef } =
        await loadLazyExtensionFresh()

      await registerNodeDef(nodeTypeWithId(1), makeNodeDef(nodeName))

      expect(registeredNames()).toEqual(LAZY_EXTENSION_REGISTRATION_ORDER)
    }
  )

  it.for(['Load3D', 'Load3DAdvanced'])(
    'injects mesh_upload spec flags into the model_file widget for %s nodes',
    async (nodeName) => {
      const { registerNodeDef } = await loadLazyExtensionFresh()
      const { nodeData, modelFileSpec } = makeNodeDefWithModelFile(nodeName)

      await registerNodeDef(nodeTypeWithId(1), nodeData)

      expect(modelFileSpec).toMatchObject({
        mesh_upload: true,
        upload_subfolder: '3d'
      })
    }
  )

  it('does not throw when a Load3D node has no model_file widget spec', async () => {
    const { registerNodeDef } = await loadLazyExtensionFresh()
    const nodeData = makeNodeDef('Load3D', { input: { required: {} } })

    await expect(
      registerNodeDef(nodeTypeWithId(1), nodeData)
    ).resolves.toBeUndefined()
  })

  it('does not mutate model_file for non-Load3D 3D node types', async () => {
    const { registerNodeDef } = await loadLazyExtensionFresh()
    const { nodeData, modelFileSpec } = makeNodeDefWithModelFile('Preview3D')

    await registerNodeDef(nodeTypeWithId(1), nodeData)

    expect(modelFileSpec).toEqual({})
  })

  it('replays beforeRegisterNodeDef of every enabled lazy extension with the app reference', async () => {
    const { app, registerNodeDef } = await loadLazyExtensionFresh()
    const nodeType = nodeTypeWithId(1)
    const nodeData = makeNodeDef('Preview3D')

    await registerNodeDef(nodeType, nodeData)

    expect(replayCalls()).toEqual(
      lazyExtensions.map(() => [[nodeType, nodeData, app]])
    )
  })

  it('rolls back a partial registration when a lazy 3D extension name is taken, then retries once it is free', async () => {
    const { extensionStore, registeredNames, registerNodeDef, reportError } =
      await loadLazyExtensionFresh()
    extensionStore.registerExtension({ name: 'Comfy.CreateLightInfo' })

    await expect(
      registerNodeDef(nodeTypeWithId(1), makeNodeDef('Load3D'))
    ).resolves.toBeUndefined()

    expect(registeredNames()).toEqual(['Comfy.CreateLightInfo'])
    expect(replayCalls()).toEqual(lazyExtensions.map(() => []))
    expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
      errorType: 'error_loading_3d_extensions',
      surface: 'graph'
    })

    extensionStore.unregisterExtension('Comfy.CreateLightInfo')
    await registerNodeDef(nodeTypeWithId(2), makeNodeDef('Preview3D'))

    expect(registeredNames()).toEqual(LAZY_EXTENSION_REGISTRATION_ORDER)
  })

  it('registers but does not replay lazy extensions that are disabled', async () => {
    const { extensionStore, registeredNames, registerNodeDef } =
      await loadLazyExtensionFresh()
    extensionStore.loadBootDisabledExtensionNames(['Comfy.Preview3D'])

    await registerNodeDef(nodeTypeWithId(1), makeNodeDef('Load3D'))

    expect(registeredNames()).toEqual(LAZY_EXTENSION_REGISTRATION_ORDER)
    expect(
      lazyModules.load3d.preview3DExtension.beforeRegisterNodeDef
    ).not.toHaveBeenCalled()
    expect(
      lazyModules.load3d.load3dExtension.beforeRegisterNodeDef
    ).toHaveBeenCalledOnce()
  })

  it('shares one in-flight load between concurrent 3D node registrations', async () => {
    const { registeredNames, registerNodeDef } = await loadLazyExtensionFresh()

    await Promise.all([
      registerNodeDef(nodeTypeWithId(1), makeNodeDef('Load3D')),
      registerNodeDef(nodeTypeWithId(2), makeNodeDef('Preview3D'))
    ])

    expect(registeredNames()).toEqual(LAZY_EXTENSION_REGISTRATION_ORDER)
    expect(
      vi
        .mocked(lazyModules.saveMesh.saveMeshExtension.beforeRegisterNodeDef)
        .mock.calls.map(([nodeType, nodeData]) => [nodeType, nodeData.name])
    ).toEqual([
      [{ id: 1 }, 'Load3D'],
      [{ id: 2 }, 'Preview3D']
    ])
  })

  it('neither re-registers nor replays for 3D node defs after the load completes', async () => {
    const { registeredNames, registerNodeDef } = await loadLazyExtensionFresh()
    await registerNodeDef(nodeTypeWithId(1), makeNodeDef('Load3D'))

    await registerNodeDef(nodeTypeWithId(2), makeNodeDef('Preview3D'))

    expect(registeredNames()).toEqual(LAZY_EXTENSION_REGISTRATION_ORDER)
    expect(
      lazyModules.saveMesh.saveMeshExtension.beforeRegisterNodeDef
    ).toHaveBeenCalledOnce()
  })
})
