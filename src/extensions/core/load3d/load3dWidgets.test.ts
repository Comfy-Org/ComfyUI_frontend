import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import type { useLoad3d } from '@/extensions/core/load3d/composables/useLoad3d'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { MIME_ASSET_INFO } from '@/platform/assets/schemas/mediaAssetSchema'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { reportError } from '@comfyorg/telemetry/reportError'
import type { ComfyApp } from '@/scripts/app'
import { createMockFileList } from '@/utils/__tests__/litegraphTestUtils'
import { LOAD3D_NONE_MODEL } from '@comfyorg/viewport3d/load3d/constants'

import { load3dWidgets } from './load3dWidgets'

const { waitForLoad3d, markLoad3dSceneDirty, useLoad3dModule } = vi.hoisted(
  () => ({
    waitForLoad3d: vi.fn(),
    markLoad3dSceneDirty: vi.fn(),
    useLoad3dModule: { unavailable: false }
  })
)

vi.mock(import('@/extensions/core/load3d/composables/useLoad3d'), () => ({
  useLoad3d: () => fromPartial<ReturnType<typeof useLoad3d>>({ waitForLoad3d }),
  get markLoad3dSceneDirty() {
    if (useLoad3dModule.unavailable)
      throw new TypeError('Failed to fetch dynamically imported module')
    return markLoad3dSceneDirty
  }
}))
vi.mock(import('@/extensions/core/load3d/Load3dUtils'), () => ({
  default: fromAny({
    splitFilePath: (path: string) => ['', path],
    getResourceURL: () => '/view',
    uploadFile: vi.fn(),
    uploadMultipleFiles: vi.fn()
  })
}))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/i18n'))

const app = fromPartial<ComfyApp>({})

function makeNode(comfyClass: string, widgetNames: string[]) {
  const node = new (class extends LGraphNode {
    static comfyClass = comfyClass
  })(comfyClass)
  for (const name of widgetNames)
    node.addWidget('combo', name, '', () => {}, { values: [] })
  return node
}

function captureFileInputs() {
  const createElement = document.createElement.bind(document)
  const fileInputs: HTMLInputElement[] = []
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    const element = createElement(tag)
    if (element instanceof HTMLInputElement) fileInputs.push(element)
    return element
  })
  return fileInputs
}

function dropEvent({
  files = [],
  assetInfo
}: {
  files?: File[]
  assetInfo?: object
}): DragEvent {
  const data: Record<string, string> = assetInfo
    ? { [MIME_ASSET_INFO]: JSON.stringify(assetInfo) }
    : {}
  return fromAny<DragEvent, unknown>({
    dataTransfer: {
      items: files.map(() => ({ kind: 'file' })),
      files,
      types: assetInfo ? [MIME_ASSET_INFO] : ['Files'],
      getData: (format: string) => data[format] ?? ''
    }
  })
}

function modelValue(node: LGraphNode) {
  return node.widgets?.find(({ name }) => name === 'model_file')?.value
}

async function chooseFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { value: createMockFileList([file]) })
  await input.onchange!(new Event('change'))
}

describe('load3dWidgets LOAD_3D', () => {
  it.for([
    {
      comfyClass: 'Load3D',
      widgets: ['model_file'],
      expected: [
        'model_file',
        'upload 3d model',
        'upload extra resources',
        'clear',
        'image'
      ]
    },
    {
      comfyClass: 'Preview3DAdvanced',
      widgets: [],
      expected: ['viewport_state']
    }
  ])(
    'adds $expected to a $comfyClass node',
    ({ comfyClass, widgets, expected }) => {
      const node = makeNode(comfyClass, widgets)

      load3dWidgets.LOAD_3D(node, 'image', ['LOAD_3D', {}], app)

      expect(node.widgets?.map(({ name }) => name)).toEqual(expected)
    }
  )

  it('uploads the chosen model to input/3d, selects it and loads it into the viewer', async () => {
    const node = makeNode('Load3D', ['model_file'])
    const load3d = { loadModel: vi.fn().mockResolvedValue('loaded') }
    waitForLoad3d.mockImplementation((cb: (l: typeof load3d) => void) =>
      cb(load3d)
    )
    vi.mocked(Load3dUtils.uploadFile).mockResolvedValue('3d/model.glb')
    const fileInputs = captureFileInputs()
    load3dWidgets.LOAD_3D(node, 'image', ['LOAD_3D', {}], app)
    const [modelInput] = fileInputs
    const file = new File(['x'], 'model.glb')

    await chooseFile(modelInput, file)

    expect(Load3dUtils.uploadFile).toHaveBeenCalledWith(file, '3d')
    expect(node.widgets?.find(({ name }) => name === 'model_file')?.value).toBe(
      '3d/model.glb'
    )
    expect(load3d.loadModel).toHaveBeenCalledOnce()
    expect(markLoad3dSceneDirty).toHaveBeenCalledWith(node)
    expect(useToast().toasts).toEqual([])
  })

  it('shows a toast when the uploaded model fails to load', async () => {
    const node = makeNode('Load3D', ['model_file'])
    let loadFailed: Promise<void> | undefined
    waitForLoad3d.mockImplementation(
      (cb: (l: { loadModel: () => Promise<never> }) => Promise<void>) => {
        loadFailed = cb({
          loadModel: () => Promise.reject(new Error('bad glb'))
        })
      }
    )
    vi.mocked(Load3dUtils.uploadFile).mockResolvedValue('model.glb')
    const fileInputs = captureFileInputs()
    load3dWidgets.LOAD_3D(node, 'image', ['LOAD_3D', {}], app)
    const [modelInput] = fileInputs

    await chooseFile(modelInput, new File(['x'], 'model.glb'))
    await loadFailed

    expect(useToast().toasts.map(({ kind, title }) => [kind, title])).toEqual([
      ['warning', 'toastMessages.failedToLoadModel']
    ])
  })
  it('keeps the model when clearing cannot load the 3D module, and clears it on retry', async () => {
    const node = makeNode('Load3D', ['model_file'])
    load3dWidgets.LOAD_3D(node, 'image', ['LOAD_3D', {}], app)
    const modelWidget = node.widgets!.find(({ name }) => name === 'model_file')!
    const clearButton = node.widgets!.find(({ name }) => name === 'clear')!
    modelWidget.value = '3d/model.glb'
    useLoad3dModule.unavailable = true

    clearButton.callback?.(clearButton.value)
    await vi.waitFor(() =>
      expect(reportError).toHaveBeenCalledWith(
        expect.any(TypeError),
        expect.objectContaining({ errorType: 'error_loading_3d_extensions' })
      )
    )
    expect(modelWidget.value).toBe('3d/model.glb')

    useLoad3dModule.unavailable = false
    clearButton.callback?.(clearButton.value)
    await vi.waitFor(() =>
      expect(markLoad3dSceneDirty).toHaveBeenCalledWith(node)
    )
    expect(modelWidget.value).toBe(LOAD3D_NONE_MODEL)
  })
})

describe('load3dWidgets model drop onto the node', () => {
  function makeLoad3dNode(comfyClass: 'Load3D' | 'Load3DAdvanced') {
    const node = makeNode(comfyClass, ['model_file'])
    if (comfyClass === 'Load3D')
      load3dWidgets.LOAD_3D(node, 'image', ['LOAD_3D', {}], app)
    else
      load3dWidgets.LOAD_3D_ADVANCED(
        node,
        'viewport_state',
        ['LOAD_3D_ADVANCED', {}],
        app
      )
    return node
  }

  it.for(['Load3D', 'Load3DAdvanced'] as const)(
    'uploads a model file dropped onto a %s node and selects it',
    async (comfyClass) => {
      const node = makeLoad3dNode(comfyClass)
      vi.mocked(Load3dUtils.uploadFile).mockResolvedValue('3d/dropped.glb')
      const file = new File(['x'], 'dropped.glb')

      const claimed = await node.onDragDrop?.(dropEvent({ files: [file] }))

      expect(claimed).toBe(true)
      expect(Load3dUtils.uploadFile).toHaveBeenCalledWith(file, '3d')
      expect(modelValue(node)).toBe('3d/dropped.glb')
    }
  )

  it.for(['Load3D', 'Load3DAdvanced'] as const)(
    'selects a 3D asset dropped onto a %s node without uploading it again',
    async (comfyClass) => {
      const node = makeLoad3dNode(comfyClass)

      const claimed = await node.onDragDrop?.(
        dropEvent({
          assetInfo: { filename: 'mesh.glb', subfolder: '3d', type: 'output' }
        })
      )

      expect(claimed).toBe(true)
      expect(Load3dUtils.uploadFile).not.toHaveBeenCalled()
      expect(modelValue(node)).toBe('3d/mesh.glb [output]')
      expect(
        node.widgets?.find(({ name }) => name === 'model_file')?.options.values
      ).toContain('3d/mesh.glb [output]')
      expect(markLoad3dSceneDirty).toHaveBeenCalledWith(node)
    }
  )

  it('warns and keeps the model when the dropped asset is not a 3D model', async () => {
    const node = makeLoad3dNode('Load3D')
    const modelWidget = node.widgets!.find(({ name }) => name === 'model_file')!
    modelWidget.value = '3d/kept.glb'

    await node.onDragDrop?.(
      dropEvent({
        assetInfo: { filename: 'photo.png', subfolder: '', type: 'output' }
      })
    )

    expect(modelWidget.value).toBe('3d/kept.glb')
    expect(useToast().toasts.map(({ kind, title }) => [kind, title])).toEqual([
      ['warning', 'load3d.unsupportedFileType']
    ])
  })

  it('leaves a dropped non-model file to the canvas', async () => {
    const node = makeLoad3dNode('Load3D')

    const claimed = await node.onDragDrop?.(
      dropEvent({ files: [new File(['x'], 'photo.png')] })
    )

    expect(claimed).toBe(false)
    expect(Load3dUtils.uploadFile).not.toHaveBeenCalled()
  })

  it('does not accept drops on a 3D preview node', () => {
    const node = makeNode('Preview3DAdvanced', [])

    load3dWidgets.LOAD_3D(node, 'viewport_state', ['LOAD_3D', {}], app)

    expect(node.onDragDrop).toBeUndefined()
  })
})

describe('load3dWidgets model changes in the undo history', () => {
  function trackUndoSnapshots(node: LGraphNode) {
    const snapshots: unknown[] = []
    useWorkflowStore().activeWorkflow = fromPartial({
      changeTracker: {
        captureCanvasState: () => snapshots.push(modelValue(node))
      }
    })
    return snapshots
  }

  function makeLoad3dNode() {
    const node = makeNode('Load3D', ['model_file'])
    load3dWidgets.LOAD_3D(node, 'image', ['LOAD_3D', {}], app)
    return node
  }

  it('records a dropped model file as one undo step', async () => {
    const node = makeLoad3dNode()
    const snapshots = trackUndoSnapshots(node)
    vi.mocked(Load3dUtils.uploadFile).mockResolvedValue('3d/dropped.glb')

    await node.onDragDrop?.(
      dropEvent({ files: [new File(['x'], 'dropped.glb')] })
    )

    expect(snapshots).toEqual(['3d/dropped.glb'])
  })

  it('records a dropped 3D asset as one undo step', async () => {
    const node = makeLoad3dNode()
    const snapshots = trackUndoSnapshots(node)

    await node.onDragDrop?.(
      dropEvent({
        assetInfo: { filename: 'mesh.glb', subfolder: '', type: 'output' }
      })
    )

    expect(snapshots).toEqual(['mesh.glb [output]'])
  })

  it('records a model chosen with the upload button as one undo step', async () => {
    const node = makeNode('Load3D', ['model_file'])
    const fileInputs = captureFileInputs()
    load3dWidgets.LOAD_3D(node, 'image', ['LOAD_3D', {}], app)
    const snapshots = trackUndoSnapshots(node)
    vi.mocked(Load3dUtils.uploadFile).mockResolvedValue('3d/chosen.glb')

    await chooseFile(fileInputs[0], new File(['x'], 'chosen.glb'))

    expect(snapshots).toEqual(['3d/chosen.glb'])
  })

  it('records clearing the model as one undo step', async () => {
    const node = makeLoad3dNode()
    const modelWidget = node.widgets!.find(({ name }) => name === 'model_file')!
    const clearButton = node.widgets!.find(({ name }) => name === 'clear')!
    modelWidget.value = '3d/model.glb'
    const snapshots = trackUndoSnapshots(node)

    clearButton.callback?.(clearButton.value)

    await vi.waitFor(() => expect(snapshots).toEqual([LOAD3D_NONE_MODEL]))
  })

  it('records nothing when the dropped asset is not a 3D model', async () => {
    const node = makeLoad3dNode()
    const snapshots = trackUndoSnapshots(node)

    await node.onDragDrop?.(
      dropEvent({
        assetInfo: { filename: 'photo.png', subfolder: '', type: 'output' }
      })
    )

    expect(snapshots).toEqual([])
  })
})
