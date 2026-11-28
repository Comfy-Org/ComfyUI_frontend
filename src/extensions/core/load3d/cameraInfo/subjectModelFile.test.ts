import { describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'

import { LGraph, LGraphNode } from '@/lib/litegraph/src/litegraph'

import {
  resolveSubjectModelFile,
  toSubjectModelSource
} from './subjectModelFile'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))

function buildGraph(modelFile: string = '3d/frog.obj') {
  const graph = new LGraph()

  const camera = new LGraphNode('CreateCameraInfo')
  camera.addInput('mesh', 'MESH')
  graph.add(camera)

  const loader = new LGraphNode('Load3DAdvanced')
  loader.addOutput('model_3d', 'FILE_3D')
  loader.addWidget('combo', 'model_file', modelFile, () => {}, {
    values: [modelFile]
  })
  graph.add(loader)

  const components = new LGraphNode('Get 3D Components', 'Get3DComponents')
  components.addInput('model_3d', 'FILE_3D_GLB,FILE_3D_OBJ,FILE_3D')
  components.addOutput('mesh', 'MESH')
  graph.add(components)

  const decimate = new LGraphNode('Decimate Mesh', 'DecimateMesh')
  decimate.addInput('mesh', 'MESH')
  decimate.addOutput('mesh', 'MESH')
  graph.add(decimate)

  const generator = new LGraphNode('GenerateMesh')
  generator.addOutput('mesh', 'MESH')
  graph.add(generator)

  return { camera, loader, components, decimate, generator }
}

function modelWidget(node: LGraphNode) {
  const widget = node.widgets?.find((w) => w.name === 'model_file')
  if (!widget) throw new Error('missing model_file widget')
  return widget
}

describe('resolveSubjectModelFile', () => {
  it('is undefined when another node reshapes the mesh on the way', () => {
    const { camera, loader, components, decimate } = buildGraph()
    loader.connect(0, components, 0)
    components.connect(0, decimate, 0)
    decimate.connect(0, camera, 0)

    expect(resolveSubjectModelFile(camera, camera.id)).toBeUndefined()
  })

  it('is undefined while Get 3D Components has no model connected', () => {
    const { camera, components } = buildGraph()
    components.connect(0, camera, 0)

    expect(resolveSubjectModelFile(camera, camera.id)).toBeUndefined()
  })

  it('is undefined when the mesh does not come from a file', () => {
    const { camera, generator } = buildGraph()
    generator.connect(0, camera, 0)

    expect(resolveSubjectModelFile(camera, camera.id)).toBeUndefined()
  })

  it.for(['none', ''])(
    'is undefined when the loader file is "%s"',
    (modelFile) => {
      const { camera, loader, components } = buildGraph(modelFile)
      loader.connect(0, components, 0)
      components.connect(0, camera, 0)

      expect(resolveSubjectModelFile(camera, camera.id)).toBeUndefined()
    }
  )

  it('follows connection and file changes reactively', () => {
    const { camera, loader, components } = buildGraph()
    const modelFile = computed(() => resolveSubjectModelFile(camera, camera.id))
    expect(modelFile.value).toBeUndefined()

    loader.connect(0, components, 0)
    components.connect(0, camera, 0)
    expect(modelFile.value).toBe('3d/frog.obj')

    modelWidget(loader).value = 'robot.glb'
    expect(modelFile.value).toBe('robot.glb')

    camera.disconnectInput(0)
    expect(modelFile.value).toBeUndefined()
  })
})

describe('toSubjectModelSource', () => {
  it.for([
    {
      modelFile: 'frog.obj',
      source: { rootFolder: 'input', subfolder: '', filename: 'frog.obj' }
    },
    {
      modelFile: '3d/props/frog.obj',
      source: {
        rootFolder: 'input',
        subfolder: '3d/props',
        filename: 'frog.obj'
      }
    },
    {
      modelFile: '3d/frog.glb [output]',
      source: { rootFolder: 'output', subfolder: '3d', filename: 'frog.glb' }
    },
    {
      modelFile: 'frog.glb [temp]',
      source: { rootFolder: 'temp', subfolder: '', filename: 'frog.glb' }
    }
  ])('reads $modelFile', ({ modelFile, source }) => {
    expect(toSubjectModelSource(modelFile)).toEqual(source)
  })
})
