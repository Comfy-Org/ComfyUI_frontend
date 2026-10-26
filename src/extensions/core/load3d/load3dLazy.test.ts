import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { LGraphNode } from '@/lib/litegraph/src/LGraphNode'
import type { ComfyNodeDef } from '@/schemas/nodeDefSchema'

const lazyModules = vi.hoisted(() => {
  const defineExtension = (name: string) => ({
    name,
    nodeCreated: vi.fn()
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

const replayedNodes = () =>
  lazyExtensions.map(({ nodeCreated }) => vi.mocked(nodeCreated).mock.calls)

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

function makeNode(comfyClass: string) {
  return fromAny<LGraphNode, unknown>({ constructor: { comfyClass } })
}

function makeNodeDef(name: string, extra: Partial<ComfyNodeDef> = {}) {
  return fromPartial<ComfyNodeDef>({ name, ...extra })
}

function makeWorkflow(rootTypes: string[], subgraphTypes: string[] = []) {
  const toNodes = (types: string[]) =>
    types.map((type, index) => ({ id: index + 1, type }))
  return fromPartial<ComfyWorkflowJSON>({
    nodes: toNodes(rootTypes),
    definitions: {
      subgraphs: [
        {
          id: 'subgraph-1',
          name: 'Subgraph',
          inputNode: {},
          outputNode: {},
          nodes: toNodes(subgraphTypes)
        }
      ]
    }
  })
}

const { load3dLazyExtension } =
  await import('@/extensions/core/load3d/load3dLazy')

type ComfyWorkflowJSON = Parameters<
  NonNullable<typeof load3dLazyExtension.beforeConfigureGraph>
>[0]

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
    registerNodeDef: (nodeData: ComfyNodeDef) =>
      load3dLazyExtension.beforeRegisterNodeDef!(
        fromAny<typeof LGraphNode, unknown>({}),
        nodeData,
        app
      ),
    configureGraph: (graphData: ComfyWorkflowJSON) =>
      load3dLazyExtension.beforeConfigureGraph!(graphData, [], app),
    createNode: (node: LGraphNode) =>
      load3dLazyExtension.nodeCreated!(node, app)
  }
}

describe('load3dLazy', () => {
  it.for(['PlainNode', 'Load3D', 'Preview3D', 'SaveGLB', 'CameraAngle'])(
    'does not load the 3D extensions when registering the %s node def',
    async (nodeName) => {
      const { registeredNames, registerNodeDef } =
        await loadLazyExtensionFresh()

      await registerNodeDef(makeNodeDef(nodeName))

      expect(registeredNames()).toEqual([])
    }
  )

  it('registers the 3D widgets and settings without loading the 3D extensions', async () => {
    expect(
      Object.keys(load3dLazyExtension.getCustomWidgets!(fromAny({})))
    ).toEqual([
      'LOAD_3D',
      'PREVIEW_3D',
      'LOAD_3D_ADVANCED',
      'CAMERA_INFO_STATE',
      'CAMERA_ANGLE_VIEW'
    ])
    expect(load3dLazyExtension.settings?.map(({ id }) => id)).toContain(
      'Comfy.Load3D.ShowGrid'
    )
  })

  it.for([
    {
      name: 'Load3D',
      required: { model_file: ['COMBO', {}], image: ['LOAD_3D', {}] },
      expected: {
        model_file: ['COMBO', { mesh_upload: true, upload_subfolder: '3d' }],
        image: ['LOAD_3D', {}]
      }
    },
    {
      name: 'Load3DAdvanced',
      required: { model_file: ['COMBO', {}] },
      expected: {
        model_file: ['COMBO', { mesh_upload: true, upload_subfolder: '3d' }],
        viewport_state: ['LOAD_3D_ADVANCED', {}]
      }
    },
    {
      name: 'Load3D',
      required: {},
      expected: {}
    },
    {
      name: 'Preview3D',
      required: { model_file: ['STRING', {}], image: ['STRING', {}] },
      expected: { model_file: ['STRING', {}], image: ['PREVIEW_3D'] }
    },
    {
      name: 'SaveGLB',
      required: { mesh: ['MESH', {}] },
      expected: { mesh: ['MESH', {}], image: ['PREVIEW_3D'] }
    },
    {
      name: 'Preview3DAdvanced',
      required: { model_file: ['STRING', {}] },
      expected: { model_file: ['STRING', {}] }
    },
    {
      name: 'PlainNode',
      required: { model_file: ['COMBO', {}] },
      expected: { model_file: ['COMBO', {}] }
    }
  ])(
    'patches the $name node def inputs $required to $expected',
    async ({ name, required, expected }) => {
      const { registerNodeDef } = await loadLazyExtensionFresh()
      const nodeData = makeNodeDef(name, { input: fromAny({ required }) })

      await registerNodeDef(nodeData)

      expect(nodeData.input?.required).toEqual(expected)
    }
  )

  it('adds the PREVIEW_3D input to a SaveGLB node def that has no inputs', async () => {
    const { registerNodeDef } = await loadLazyExtensionFresh()
    const nodeData = makeNodeDef('SaveGLB')

    await registerNodeDef(nodeData)

    expect(nodeData.input).toEqual({ required: { image: ['PREVIEW_3D'] } })
  })

  it.for([
    {
      case: 'only non-3D nodes',
      root: ['KSampler'],
      subgraph: [],
      loads: false
    },
    {
      case: 'a root 3D node',
      root: ['KSampler', 'Load3D'],
      subgraph: [],
      loads: true
    },
    {
      case: 'a 3D node in a subgraph',
      root: ['KSampler'],
      subgraph: ['Preview3D'],
      loads: true
    }
  ])(
    'before configuring a workflow with $case, loads the 3D extensions: $loads',
    async ({ root, subgraph, loads }) => {
      const { registeredNames, configureGraph } = await loadLazyExtensionFresh()

      await configureGraph(makeWorkflow(root, subgraph))

      expect(registeredNames()).toEqual(
        loads ? LAZY_EXTENSION_REGISTRATION_ORDER : []
      )
    }
  )

  it('ignores non-3D nodes as they are created', async () => {
    const { registeredNames, createNode } = await loadLazyExtensionFresh()

    await createNode(makeNode('KSampler'))

    expect(registeredNames()).toEqual([])
    expect(replayedNodes()).toEqual(lazyExtensions.map(() => []))
  })

  it('loads the 3D extensions for a 3D node created before they loaded and replays their nodeCreated hooks', async () => {
    const { app, registeredNames, createNode } = await loadLazyExtensionFresh()
    const node = makeNode('Load3D')

    await createNode(node)

    expect(registeredNames()).toEqual(LAZY_EXTENSION_REGISTRATION_ORDER)
    expect(replayedNodes()).toEqual(lazyExtensions.map(() => [[node, app]]))
  })

  it('replays nodeCreated for every 3D node created while the load is in flight', async () => {
    const { app, createNode } = await loadLazyExtensionFresh()
    const load3dNode = makeNode('Load3D')
    const cameraNode = makeNode('CreateCameraInfo')

    await Promise.all([createNode(load3dNode), createNode(cameraNode)])

    expect(replayedNodes()).toEqual(
      lazyExtensions.map(() => [
        [load3dNode, app],
        [cameraNode, app]
      ])
    )
  })

  it('reports a replayed nodeCreated hook that throws and still replays the others', async () => {
    const { app, reportError, createNode } = await loadLazyExtensionFresh()
    const cause = new Error('hook failed')
    vi.mocked(
      lazyModules.load3d.load3dExtension.nodeCreated
    ).mockImplementation(() => {
      throw cause
    })
    const node = makeNode('Load3D')

    await createNode(node)

    expect(
      lazyModules.lightInfo.lightInfoExtension.nodeCreated
    ).toHaveBeenCalledWith(node, app)
    expect(reportError).toHaveBeenCalledExactlyOnceWith(cause, {
      errorType: 'error_replaying_3d_node_created',
      surface: 'graph',
      context: { extension: 'Comfy.Load3D' }
    })
  })

  it('does not replay nodeCreated for 3D nodes created after the load completes', async () => {
    const { configureGraph, createNode } = await loadLazyExtensionFresh()
    await configureGraph(makeWorkflow(['Load3D']))

    await createNode(makeNode('Preview3D'))

    expect(replayedNodes()).toEqual(lazyExtensions.map(() => []))
  })

  it('registers but does not replay lazy extensions that are disabled', async () => {
    const { extensionStore, registeredNames, createNode } =
      await loadLazyExtensionFresh()
    extensionStore.loadDisabledExtensionNames(['Comfy.Preview3D'])

    await createNode(makeNode('Preview3D'))

    expect(registeredNames()).toEqual(LAZY_EXTENSION_REGISTRATION_ORDER)
    expect(
      lazyModules.load3d.preview3DExtension.nodeCreated
    ).not.toHaveBeenCalled()
    expect(
      lazyModules.load3d.load3dExtension.nodeCreated
    ).toHaveBeenCalledOnce()
  })

  it('rolls back a partial registration when a lazy 3D extension name is taken, then retries once it is free', async () => {
    const { extensionStore, registeredNames, createNode, reportError } =
      await loadLazyExtensionFresh()
    extensionStore.registerExtension({ name: 'Comfy.CreateLightInfo' })

    await expect(createNode(makeNode('Load3D'))).resolves.toBeUndefined()

    expect(registeredNames()).toEqual(['Comfy.CreateLightInfo'])
    expect(replayedNodes()).toEqual(lazyExtensions.map(() => []))
    expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
      errorType: 'error_loading_3d_extensions',
      surface: 'graph'
    })

    extensionStore.unregisterExtension('Comfy.CreateLightInfo')
    await createNode(makeNode('Preview3D'))

    expect(registeredNames()).toEqual(LAZY_EXTENSION_REGISTRATION_ORDER)
  })
})
