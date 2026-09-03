import { expect, it, vi } from 'vitest'

import { reportError } from '@/platform/telemetry/reportError'

const { getUserData, registerExtension, reportErrorMock } = vi.hoisted(() => ({
  getUserData: vi.fn(),
  registerExtension: vi.fn(),
  reportErrorMock: vi.fn()
}))

vi.mock('@/base/common/downloadUtil', () => ({ downloadBlob: vi.fn() }))

vi.mock('@/platform/telemetry/reportError', () => ({
  reportError: reportErrorMock
}))

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: () => ({ addAlert: vi.fn() })
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
  app: { registerExtension, canvas: { selected_nodes: {} } }
}))

vi.mock('@/scripts/ui', () => ({
  ComfyDialog: class {
    element = document.createElement('div')
  },
  $el: (tag: string) => document.createElement(tag)
}))

let resolveResponse!: (response: {
  status: number
  json: () => Promise<never>
}) => void
getUserData.mockReturnValue(
  new Promise((resolve) => {
    resolveResponse = resolve
  })
)

await import('./nodeTemplates')

it('reports invalid persisted node templates before falling back to empty', async () => {
  const error = new Error('invalid template JSON')
  resolveResponse({
    status: 200,
    json: () => Promise.reject(error)
  })

  await vi.waitFor(() => {
    expect(reportError).toHaveBeenCalledWith(error, {
      errorType: 'extensions_node_templates_load_swallowed',
      tags: {
        failure_kind: 'caught_unexpected',
        feature_area: 'extensions',
        operation: 'load',
        outcome: 'recovered'
      },
      level: 'error'
    })
  })
})
