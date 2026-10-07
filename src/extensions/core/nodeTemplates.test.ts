import { fromAny, fromPartial } from '@total-typescript/shoehorn'
import { expect, it, vi } from 'vitest'

import {
  CANVAS_CLIPBOARD_ID_KEY,
  CANVAS_CLIPBOARD_KEY
} from '@/lib/litegraph/src/litegraph'
import type { LGraphCanvas } from '@/lib/litegraph/src/litegraph'
import { reportError } from '@/platform/telemetry/reportError'
import type { ComfyApi } from '@/scripts/api'
import { app } from '@/scripts/app'
import { useDialogService } from '@/services/dialogService'

const getUserData = vi.hoisted(() => vi.fn())

vi.mock(import('@/base/common/downloadUtil'), () => ({ downloadBlob: vi.fn() }))

vi.mock(import('@/platform/telemetry/reportError'))

vi.mock(import('@/services/dialogService'))

vi.mock(import('@/utils/vintageClipboard'), () => ({
  deserialiseAndCreate: vi.fn()
}))

vi.mock(import('@/scripts/api'), () => ({
  api: fromPartial<ComfyApi>({ getUserData, storeUserData: vi.fn() })
}))

vi.mock(import('@/scripts/app'))

vi.mock(import('@/scripts/ui'), () => ({
  ComfyDialog: fromAny(
    class {
      element = document.createElement('div')
    }
  ),
  $el: fromAny((tag: string) => document.createElement(tag))
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
const extension = vi.mocked(app.registerExtension).mock.calls[0][0]

it('reports invalid persisted node templates before falling back to empty', async () => {
  const error = new Error('invalid template JSON')
  response.resolve({
    status: 200,
    json: () => Promise.reject(error)
  })

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

it('restores the canvas clipboard and its id after saving a template', async () => {
  localStorage.setItem(CANVAS_CLIPBOARD_KEY, '{"nodes":[]}')
  localStorage.setItem(CANVAS_CLIPBOARD_ID_KEY, 'copy-1')
  vi.mocked(useDialogService).mockReturnValue(
    fromPartial({ prompt: async () => 'Template' })
  )
  app.canvas = fromPartial<LGraphCanvas>({
    selected_nodes: {},
    copyToClipboard: () => {
      localStorage.setItem(CANVAS_CLIPBOARD_KEY, '{"nodes":[{}]}')
      localStorage.setItem(CANVAS_CLIPBOARD_ID_KEY, 'template-copy')
      return '{"nodes":[{}]}'
    }
  })
  const saveItem = extension.getCanvasMenuItems?.(fromAny({}))[1]

  await saveItem?.callback?.call(fromAny({}))

  expect(localStorage.getItem(CANVAS_CLIPBOARD_KEY)).toBe('{"nodes":[]}')
  expect(localStorage.getItem(CANVAS_CLIPBOARD_ID_KEY)).toBe('copy-1')
})
