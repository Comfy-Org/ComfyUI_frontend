import { fromAny } from '@total-typescript/shoehorn'
import { expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

const { extensions, getUserData, reportErrorMock } = await vi.hoisted(
  async () => {
    const { createExtensionCapture } =
      await import('@/utils/__tests__/extensionTestUtils')
    return {
      extensions: createExtensionCapture(),
      getUserData: vi.fn(),
      reportErrorMock: vi.fn()
    }
  }
)

vi.mock('@/base/common/downloadUtil', () => ({ downloadBlob: vi.fn() }))

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: reportErrorMock
}))

vi.mock('@/services/dialogService', () => ({
  useDialogService: () => ({ prompt: vi.fn() })
}))

vi.mock('@/utils/vintageClipboard', () => ({
  deserialiseAndCreate: vi.fn()
}))

vi.mock('@/scripts/api', () => ({
  api: { getUserData, storeUserData: vi.fn() }
}))

vi.mock('@/scripts/app', () => ({
  app: {
    registerExtension: extensions.registerExtension,
    canvas: { selected_nodes: {} }
  }
}))

vi.mock('@/scripts/ui', () => ({
  ComfyDialog: class {
    element = document.createElement('div')
  },
  $el: (tag: string) => document.createElement(tag)
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

const response = createDeferred<{
  status: number
  json: () => Promise<unknown>
}>()
getUserData.mockReturnValue(response.promise)

await import('./nodeTemplates')

it('reports invalid persisted node templates before falling back to empty', async () => {
  const error = new Error('invalid template JSON')
  response.resolve({
    status: 200,
    json: () => Promise.reject(error)
  })

  await vi.waitFor(() => {
    expect(reportError).toHaveBeenCalledWith(error, {
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

  const extension = extensions.getExtension('Comfy.NodeTemplates')
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
