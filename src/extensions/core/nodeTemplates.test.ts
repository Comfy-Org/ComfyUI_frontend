import { expect, it, onTestFinished, vi } from 'vitest'
import { reportError } from '@comfyorg/telemetry/reportError'

import {
  CANVAS_CLIPBOARD_ID_KEY,
  CANVAS_CLIPBOARD_KEY
} from '@/core/graph/clipboard/clipboardStorage'
import { LGraph, LGraphNode, LiteGraph } from '@/lib/litegraph/src/litegraph'
import { api } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useDialogService } from '@/services/dialogService'
import {
  createMockCanvasRenderingContext2D,
  createTestCanvas
} from '@/utils/__tests__/canvasTestUtils'

import { createNodeTemplatesExtension } from './nodeTemplates'

vi.mock(import('@/base/common/downloadUtil'), () => ({ downloadBlob: vi.fn() }))

vi.mock(import('@/services/dialogService'))

vi.mock(import('@/core/graph/clipboard/vintageClipboard'), () => ({
  deserialiseAndCreate: vi.fn()
}))

vi.mock(import('@/scripts/api'))

vi.mock(import('@/scripts/app'))

vi.mock(import('@/scripts/ui'), async () => ({
  ComfyDialog: (await import('@/scripts/ui/dialog')).ComfyDialog
}))

function createDeferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error('Deferred promise was not initialized')
  }
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise
  })
  return { promise, resolve }
}

function createNodeTemplates(getUserData: () => Promise<Response>) {
  vi.mocked(api.getUserData).mockImplementation(getUserData)
  const extension = createNodeTemplatesExtension()
  const canvas = createTestCanvas(
    new LGraph(),
    createMockCanvasRenderingContext2D()
  )
  onTestFinished(() => canvas.unbindEvents())
  return { extension, canvas }
}

it('defers loading templates and creating the import input until setup', async () => {
  const { extension } = createNodeTemplates(async () => new Response(null))

  expect(api.getUserData).not.toHaveBeenCalled()
  expect(document.body.childElementCount).toBe(0)

  await extension.setup?.(app)
  await extension.setup?.(app)

  expect(api.getUserData).toHaveBeenCalledOnce()
  expect(document.body.querySelectorAll('input[type="file"]')).toHaveLength(1)
})

it('reports invalid persisted node templates before falling back to empty', async () => {
  const response = createDeferred<Response>()
  const { extension, canvas } = createNodeTemplates(() => response.promise)
  await extension.setup?.(app)
  const error = new Error('invalid template JSON')
  const invalidResponse = new Response()
  vi.spyOn(invalidResponse, 'json').mockRejectedValue(error)
  response.resolve(invalidResponse)

  await vi.waitFor(() => {
    expect(reportError).toHaveBeenCalledWith(error, {
      surface: 'graph',
      errorType: 'failure_loading_node_templates',
      tags: {
        failure_kind: 'caught_unexpected',
        feature_area: 'extensions',
        operation: 'load',
        outcome: 'recovered'
      },
      level: 'error'
    })
  })

  if (!extension.getCanvasMenuItems) {
    throw new Error('Comfy.NodeTemplates does not register canvas menu items')
  }
  expect(extension.getCanvasMenuItems(canvas)).toEqual([
    null,
    expect.objectContaining({ content: 'Save Selected as Template' }),
    {
      content: 'Node Templates',
      submenu: {
        options: [null, expect.objectContaining({ content: 'Manage' })]
      }
    }
  ])
})

it('does not overwrite stored templates after the initial load fails', async () => {
  const { extension, canvas } = createNodeTemplates(() =>
    Promise.reject(new Error('offline'))
  )
  vi.mocked(useDialogService().prompt).mockResolvedValue('New template')
  await extension.setup?.(app)
  await vi.waitFor(() => expect(reportError).toHaveBeenCalled())

  const saveItem = extension.getCanvasMenuItems?.(canvas)[1]
  await saveItem?.callback?.call(document.createElement('div'))

  expect(api.storeUserData).not.toHaveBeenCalled()
  expect(extension.getCanvasMenuItems?.(canvas)[2]).toEqual({
    content: 'Node Templates',
    submenu: {
      options: [null, expect.objectContaining({ content: 'Manage' })]
    }
  })
})

it('keeps stored templates when saving before the initial load finishes', async () => {
  const response = createDeferred<Response>()
  const { extension, canvas } = createNodeTemplates(() => response.promise)
  vi.mocked(useDialogService().prompt).mockResolvedValue('New template')
  await extension.setup?.(app)

  const saveItem = extension.getCanvasMenuItems?.(canvas)[1]
  const saving = saveItem?.callback?.call(document.createElement('div'))
  response.resolve(Response.json([{ name: 'Stored', data: '{}' }]))
  await saving

  const written: unknown = JSON.parse(
    String(vi.mocked(api.storeUserData).mock.calls[0][1])
  )
  expect(written).toEqual([
    { name: 'Stored', data: '{}' },
    expect.objectContaining({ name: 'New template' })
  ])
})

it('saves and inserts selected nodes with blocked storage without changing the clipboard', async () => {
  const { extension, canvas } = createNodeTemplates(async () =>
    Response.json([])
  )
  const nodeType = 'test/storage-independent-template'
  LiteGraph.registerNodeType(nodeType, class extends LGraphNode {})
  onTestFinished(() => {
    delete LiteGraph.registered_node_types[nodeType]
  })
  const node = LiteGraph.createNode(nodeType)
  if (!node || !canvas.graph) throw new Error('Template canvas is unavailable')
  canvas.graph.add(node)
  node.title = 'Current selection'
  canvas.selectItems([node])
  canvas.graph_mouse[0] = 317
  canvas.graph_mouse[1] = 451
  vi.mocked(useDialogService().prompt).mockResolvedValue('Selected template')
  await extension.setup?.(app)

  const previousClipboard = localStorage.getItem(CANVAS_CLIPBOARD_KEY)
  const previousStamp = localStorage.getItem(CANVAS_CLIPBOARD_ID_KEY)
  const get = vi.spyOn(localStorage, 'getItem')
  const set = vi.spyOn(localStorage, 'setItem')
  const remove = vi.spyOn(localStorage, 'removeItem')
  onTestFinished(() => {
    get.mockRestore()
    set.mockRestore()
    remove.mockRestore()
    if (previousClipboard === null)
      localStorage.removeItem(CANVAS_CLIPBOARD_KEY)
    else localStorage.setItem(CANVAS_CLIPBOARD_KEY, previousClipboard)
    if (previousStamp === null) localStorage.removeItem(CANVAS_CLIPBOARD_ID_KEY)
    else localStorage.setItem(CANVAS_CLIPBOARD_ID_KEY, previousStamp)
  })
  localStorage.setItem(CANVAS_CLIPBOARD_KEY, 'earlier graph copy')
  localStorage.setItem(CANVAS_CLIPBOARD_ID_KEY, 'earlier stamp')
  const blocked = () => {
    throw new DOMException('Storage is blocked', 'SecurityError')
  }
  get.mockImplementation(blocked)
  set.mockImplementation(blocked)
  remove.mockImplementation(blocked)
  try {
    const save = extension.getCanvasMenuItems?.(canvas)[1]
    await save?.callback?.call(document.createElement('div'))
    expect(api.storeUserData).toHaveBeenCalledOnce()
    const templates =
      extension.getCanvasMenuItems?.(canvas)[2]?.submenu?.options
    const insert = templates?.[0]
    if (!insert || typeof insert === 'string')
      throw new Error('Saved template is unavailable')
    await insert.callback?.call(document.createElement('div'))

    expect(canvas.graph.nodes.map(({ title }) => title)).toEqual([
      'Current selection',
      'Current selection'
    ])
    const [inserted] = [...canvas.selectedItems]
    expect(inserted).not.toBe(node)
    expect(Array.from(inserted.pos)).toEqual([317, 451])
  } finally {
    get.mockRestore()
    set.mockRestore()
    remove.mockRestore()
  }
  expect(localStorage.getItem(CANVAS_CLIPBOARD_KEY)).toBe('earlier graph copy')
  expect(localStorage.getItem(CANVAS_CLIPBOARD_ID_KEY)).toBe('earlier stamp')
})

it('keeps both templates when two saves overlap', async () => {
  const { extension, canvas } = createNodeTemplates(async () =>
    Response.json([])
  )
  vi.mocked(useDialogService().prompt)
    .mockResolvedValueOnce('First')
    .mockResolvedValueOnce('Second')
  await extension.setup?.(app)

  const saveItem = extension.getCanvasMenuItems?.(canvas)[1]
  const receiver = document.createElement('div')
  await Promise.all([
    saveItem?.callback?.call(receiver),
    saveItem?.callback?.call(receiver)
  ])

  const written: unknown = JSON.parse(
    String(vi.mocked(api.storeUserData).mock.calls.at(-1)?.[1])
  )
  expect(written).toEqual([
    expect.objectContaining({ name: 'First' }),
    expect.objectContaining({ name: 'Second' })
  ])
})
