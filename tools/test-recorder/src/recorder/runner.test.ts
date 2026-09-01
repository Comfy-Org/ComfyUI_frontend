import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as TemplateModule from './template'

const {
  cleanupRecordedCode,
  cleanupRecordingTemplate,
  ensureStorageStateDir,
  generateRecordingTemplate,
  removeLegacyCustomStorageState,
  runCommand,
  storageStatePath
} = vi.hoisted(() => ({
  cleanupRecordedCode: vi.fn(),
  cleanupRecordingTemplate: vi.fn(),
  ensureStorageStateDir: vi.fn(),
  generateRecordingTemplate: vi.fn(),
  removeLegacyCustomStorageState: vi.fn(),
  runCommand: vi.fn(() => ({ status: 1 })),
  storageStatePath: vi.fn((key: string) => `/state/storage-state.${key}.json`)
}))

vi.mock('./template', async (importOriginal) => ({
  ...(await importOriginal<typeof TemplateModule>()),
  cleanupRecordedCode,
  cleanupRecordingTemplate,
  ensureStorageStateDir,
  generateRecordingTemplate,
  recordedCodePath: vi.fn(() => '/missing-recorded-code'),
  removeLegacyCustomStorageState,
  storageStatePath
}))
vi.mock('../checks/devServerUrl', () => ({
  devServerUrl: vi.fn(() => 'http://localhost:5173')
}))
vi.mock('../cli/run', () => ({ runCommand }))
vi.mock('../featureFlags', () => ({
  buildFfQuery: vi.fn(() => '')
}))
vi.mock('../ui/logger', () => ({ box: vi.fn(), info: vi.fn() }))

import { runRecording } from './runner'

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('runRecording', () => {
  it('removes the shared legacy state before recording a custom backend', async () => {
    await runRecording({
      testName: 'custom backend',
      projectRoot: '/project',
      distribution: {
        id: 'custom',
        label: 'Custom backend',
        hint: '',
        script: 'dev',
        needsLocalBackend: false,
        backendUrl: 'http://localhost:8100/'
      }
    })

    expect(removeLegacyCustomStorageState).toHaveBeenCalledOnce()
    expect(removeLegacyCustomStorageState).toHaveBeenCalledWith(
      '/state/storage-state.custom-http%3A%2F%2Flocalhost%3A8100.json'
    )
  })
})
