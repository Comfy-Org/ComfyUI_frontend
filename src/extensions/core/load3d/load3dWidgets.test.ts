import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import type { useLoad3d } from '@/extensions/core/load3d/composables/useLoad3d'
import Load3dUtils from '@/extensions/core/load3d/Load3dUtils'
import { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
import type { ComfyApp } from '@/scripts/app'
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
vi.mock(import('@/platform/telemetry/reportError'))

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

async function chooseFile(input: HTMLInputElement, file: File) {
  Object.defineProperty(input, 'files', { value: [file] })
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
