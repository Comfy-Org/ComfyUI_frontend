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

async function importNodeTemplates(getUserData: Promise<Response>) {
  vi.resetModules()
  document.body.replaceChildren()
  const { api } = await import('@/scripts/api')
  const { app } = await import('@/scripts/app')
  const { reportError } = await import('@/platform/telemetry/reportError')
  vi.mocked(api.getUserData).mockReturnValue(getUserData)
  await import('./nodeTemplates')
  const extension = vi.mocked(app.registerExtension).mock.calls[0][0]
  return { api, app, reportError, extension }
}

it('defers loading templates and creating the import input until setup', async () => {
  const { api, app, extension } = await importNodeTemplates(
    Promise.resolve(new Response(null))
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
    response.promise
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
