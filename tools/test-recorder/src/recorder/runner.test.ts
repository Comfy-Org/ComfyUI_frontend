import type { SpawnSyncReturns } from 'node:child_process'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  cleanupRecordedCode,
  cleanupRecordingTemplate,
  ensureStorageStateDir,
  generateRecordingTemplate,
  recordingTarget,
  removeLegacyCustomStorageState,
  runCommand,
  storageStateKey,
  storageStatePath
} = vi.hoisted(() => ({
  cleanupRecordedCode: vi.fn(),
  cleanupRecordingTemplate: vi.fn(),
  ensureStorageStateDir: vi.fn(),
  generateRecordingTemplate: vi.fn(),
  recordingTarget: vi.fn((): 'cloud' => 'cloud'),
  removeLegacyCustomStorageState: vi.fn(),
  runCommand: vi.fn(
    (): SpawnSyncReturns<Buffer> => ({
      pid: 1,
      output: [],
      stdout: Buffer.alloc(0),
      stderr: Buffer.alloc(0),
      status: 1,
      signal: null
    })
  ),
  storageStateKey: vi.fn(() => 'custom-key'),
  storageStatePath: vi.fn((key: string) => `/state/storage-state.${key}.json`)
}))

vi.mock(import('./template'), () => ({
  RECORDING_SPEC_BASENAME: '_recording-session' as const,
  cleanupRecordedCode,
  cleanupRecordingTemplate,
  ensureStorageStateDir,
  generateRecordingTemplate,
  recordedCodePath: vi.fn(() => '/missing-recorded-code'),
  recordingTarget,
  removeLegacyCustomStorageState,
  storageStateKey,
  storageStatePath
}))
vi.mock(import('../checks/devServerUrl'), () => ({
  devServerUrl: vi.fn(() => 'http://localhost:5173')
}))
vi.mock(import('../cli/run'), () => ({ runCommand }))
vi.mock(import('../featureFlags'), () => ({
  buildFfQuery: vi.fn(() => '')
}))
vi.mock(import('../ui/logger'), () => ({ box: vi.fn(), info: vi.fn() }))

import { runRecording } from './runner'

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

describe('runRecording', () => {
  it('removes the shared legacy state before recording a custom backend', async () => {
    const distribution = {
      id: 'custom',
      label: 'Custom backend',
      hint: '',
      script: 'dev',
      needsLocalBackend: false,
      backendUrl: 'http://localhost:8100/'
    } as const

    await runRecording({
      testName: 'custom backend',
      projectRoot: '/project',
      distribution
    })

    const storageStateFile = '/state/storage-state.custom-key.json'
    expect(storageStateKey).toHaveBeenCalledWith(distribution)
    expect(storageStatePath).toHaveBeenCalledWith('custom-key')
    expect(removeLegacyCustomStorageState).toHaveBeenCalledOnce()
    expect(removeLegacyCustomStorageState).toHaveBeenCalledWith(
      storageStateFile
    )
    expect(ensureStorageStateDir).toHaveBeenCalledWith(storageStateFile)
    expect(generateRecordingTemplate).toHaveBeenCalledWith(
      expect.objectContaining({ storageStateFile }),
      '/project/browser_tests'
    )
  })
})
