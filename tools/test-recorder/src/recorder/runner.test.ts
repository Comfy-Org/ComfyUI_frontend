import type { SpawnSyncReturns } from 'node:child_process'
import { describe, expect, it, vi } from 'vitest'
import type { RecordingTarget } from './template'

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
  recordingTarget: vi.fn((): RecordingTarget => 'cloud'),
  removeLegacyCustomStorageState: vi.fn(),
  runCommand: vi.fn((): SpawnSyncReturns<Buffer> => ({
    pid: 1,
    output: [],
    stdout: Buffer.alloc(0),
    stderr: Buffer.alloc(0),
    status: 1,
    signal: null
  })),
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

import { info } from '../ui/logger'
import { runRecording } from './runner'

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

  it('prints the cloud sign-in notes pre-launch for cloud targets', async () => {
    const distribution = {
      id: 'comfy-cloud',
      label: 'Comfy Cloud',
      hint: '',
      script: 'dev',
      needsLocalBackend: false
    } as const

    await runRecording({
      testName: 'cloud notes',
      projectRoot: '/project',
      distribution
    })

    expect(info).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('Cloud sign-in notes')])
    )
  })

  it('keeps the sign-in notes out of the local pre-launch output', async () => {
    vi.mocked(recordingTarget).mockReturnValueOnce('local')
    const distribution = {
      id: 'comfy-cloud',
      label: 'Comfy Cloud',
      hint: '',
      script: 'dev',
      needsLocalBackend: false
    } as const

    await runRecording({
      testName: 'local notes',
      projectRoot: '/project',
      distribution
    })

    expect(info).not.toHaveBeenCalled()
  })
})
