import { fromAny } from '@total-typescript/shoehorn'
import { expect, it, vi } from 'vitest'

vi.mock(import('@/base/common/downloadUtil'), () => ({ downloadBlob: vi.fn() }))

vi.mock(import('@/platform/telemetry/reportError'))

vi.mock(import('@/services/dialogService'))

vi.mock(import('@/utils/vintageClipboard'), () => ({
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

async function importNodeTemplates(getUserData: () => Promise<Response>) {
  vi.resetModules()
  document.body.replaceChildren()
  const { api } = await import('@/scripts/api')
  const { app } = await import('@/scripts/app')
  const { reportError } = await import('@/platform/telemetry/reportError')
  vi.mocked(api.getUserData).mockImplementation(getUserData)
  const { nodeTemplatesExtension: extension } = await import('./nodeTemplates')
  return { api, app, reportError, extension }
}

it('defers loading templates and creating the import input until setup', async () => {
  const { api, app, extension } = await importNodeTemplates(
    async () => new Response(null)
  )

  expect(api.getUserData).not.toHaveBeenCalled()
  expect(document.body.childElementCount).toBe(0)

  await extension.setup?.(app)
  await extension.setup?.(app)

  expect(api.getUserData).toHaveBeenCalledOnce()
  expect(document.body.querySelectorAll('input[type="file"]')).toHaveLength(1)
})

it('reports invalid persisted node templates before falling back to empty', async () => {
  const response = createDeferred<Response>()
  const { app, reportError, extension } = await importNodeTemplates(
    () => response.promise
  )
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
  expect(extension.getCanvasMenuItems(fromAny({}))).toEqual([
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
  const { api, app, reportError, extension } = await importNodeTemplates(() =>
    Promise.reject(new Error('offline'))
  )
  const { useDialogService } = await import('@/services/dialogService')
  vi.mocked(useDialogService().prompt).mockResolvedValue('New template')
  await extension.setup?.(app)
  await vi.waitFor(() => expect(reportError).toHaveBeenCalled())

  const saveItem = extension.getCanvasMenuItems?.(fromAny({}))[1]
  await saveItem?.callback?.call(fromAny({}))

  expect(api.storeUserData).not.toHaveBeenCalled()
  expect(extension.getCanvasMenuItems?.(fromAny({}))[2]).toEqual({
    content: 'Node Templates',
    submenu: {
      options: [null, expect.objectContaining({ content: 'Manage' })]
    }
  })
})

it('keeps stored templates when saving before the initial load finishes', async () => {
  const response = createDeferred<Response>()
  const { api, app, extension } = await importNodeTemplates(
    () => response.promise
  )
  const { useDialogService } = await import('@/services/dialogService')
  vi.mocked(useDialogService().prompt).mockResolvedValue('New template')
  await extension.setup?.(app)

  const saveItem = extension.getCanvasMenuItems?.(fromAny({}))[1]
  const saving = saveItem?.callback?.call(fromAny({}))
  response.resolve(Response.json([{ name: 'Stored', data: '{}' }]))
  await saving

  const written: unknown = JSON.parse(
    String(vi.mocked(api.storeUserData).mock.calls[0][1])
  )
  expect(written).toEqual([
    { name: 'Stored', data: '{}' },
    { name: 'New template', data: '{}' }
  ])
})

it('keeps both templates when two saves overlap', async () => {
  const { api, app, extension } = await importNodeTemplates(async () =>
    Response.json([])
  )
  const { useDialogService } = await import('@/services/dialogService')
  vi.mocked(useDialogService().prompt)
    .mockResolvedValueOnce('First')
    .mockResolvedValueOnce('Second')
  await extension.setup?.(app)

  const saveItem = extension.getCanvasMenuItems?.(fromAny({}))[1]
  await Promise.all([
    saveItem?.callback?.call(fromAny({})),
    saveItem?.callback?.call(fromAny({}))
  ])

  const written: unknown = JSON.parse(
    String(vi.mocked(api.storeUserData).mock.calls.at(-1)?.[1])
  )
  expect(written).toEqual([
    { name: 'First', data: '{}' },
    { name: 'Second', data: '{}' }
  ])
})
