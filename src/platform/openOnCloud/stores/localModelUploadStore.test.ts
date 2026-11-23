import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useFeatureFlags } from '@/composables/useFeatureFlags'

import {
  checkCloudCompatibility,
  readCloudMissingModels
} from '@/platform/openOnCloud/cloudCompatibilityApi'
import type { CloudWorkflowCheckResult } from '@/platform/openOnCloud/cloudWorkflowCheck'
import * as localModelUploadApi from '@/platform/openOnCloud/localModelUploadApi'
import * as rollout from '@/platform/openOnCloud/localOpenOnCloudRollout'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { modelFileUploadApi } from '@/platform/workspace/api/modelFileUploadApi'
import type { ModelFileUploadResult } from '@/platform/workspace/api/modelFileUploadApi'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { useLocalModelUploadStore } from './localModelUploadStore'

vi.mock(import('@/platform/openOnCloud/localModelUploadApi'))
vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/openOnCloud/cloudCompatibilityApi'))

const TASK_ID = '8c2d4e6f-1a3b-4c5d-9e7f-0a1b2c3d4e5f'
const lora = { folder: 'loras', name: 'retro_anime_style.safetensors' }
const loraFile = new File(['0123456789'], lora.name)
const ckpt = { folder: 'checkpoints', name: 'base.safetensors' }
const ckptFile = new File(['01234'], ckpt.name)
const nested = { folder: 'loras', name: 'styles/retro.safetensors' }

function setWorkspace(id: string | null) {
  Object.assign(useTeamWorkspaceStore(), { activeWorkspaceId: id })
}

async function prepared(
  models = [lora],
  folders = ['loras', 'checkpoints'],
  sizes: [string, number][] = [
    [lora.name, loraFile.size],
    [ckpt.name, ckptFile.size]
  ]
) {
  vi.mocked(localModelUploadApi.readCloudUploadFolders).mockResolvedValue(
    folders
  )
  vi.mocked(localModelUploadApi.readLocalModelSizes).mockResolvedValue(
    new Map(sizes)
  )
  const store = useLocalModelUploadStore()
  await store.prepare(models)
  return store
}

describe('useLocalModelUploadStore', () => {
  let check: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    setWorkspace('ws-1')
    Object.assign(useFeatureFlags().flags, {
      openOnCloudModelUploadEnabled: true
    })
    vi.mocked(readCloudMissingModels).mockResolvedValue([])
    check = vi
      .spyOn(useCloudWorkflowCheckStore(), 'check')
      .mockResolvedValue(undefined)
  })

  it.for([
    { label: 'the same name and size', file: loraFile, status: 'chosen' },
    {
      label: 'another name',
      file: new File(['0123456789'], 'other.safetensors'),
      status: 'wrongFile'
    },
    {
      label: 'the same name but another size',
      file: new File(['0'], lora.name),
      status: 'wrongFile'
    }
  ])('takes a file with $label as $status', async ({ file, status }) => {
    const store = await prepared()

    store.choose(lora, file)

    expect(store.pickOf(lora).status).toBe(status)
    expect(store.canUpload([lora])).toBe(status === 'chosen')
  })

  it('rechecks a chosen file when the local size changes', async () => {
    const store = await prepared()
    store.choose(lora, loraFile)

    await prepared([lora], ['loras'], [[lora.name, loraFile.size + 1]])

    expect(store.pickOf(lora).status).toBe('wrongFile')
    expect(store.canUpload([lora])).toBe(false)
  })

  it('rejects a matching name when the local size is unavailable', async () => {
    const store = await prepared([lora], ['loras'], [])

    store.choose(lora, loraFile)

    expect(store.canUpload([lora])).toBe(false)
  })

  it('forgets an unsent pick when the dialog opens again', async () => {
    const store = await prepared()
    store.choose(lora, loraFile)

    store.reset([lora])

    expect(store.pickOf(lora).status).toBe('unchosen')
  })

  it.for([
    {
      label: 'a folder Comfy Cloud does not take',
      model: lora,
      folders: ['checkpoints']
    },
    {
      label: 'a subfolder the upload cannot keep',
      model: nested,
      folders: ['loras']
    }
  ])('offers no upload for $label', async ({ model, folders }) => {
    const store = await prepared([model], folders, [
      [model.name, loraFile.size]
    ])

    store.choose(model, new File(['0123456789'], model.name))

    expect(store.canTake(model)).toBe(false)
    expect(store.canUpload([model])).toBe(false)
  })

  it('rejects a mixed-format batch before sending a supported model', async () => {
    const other = { folder: 'loras', name: 'style.gguf' }
    const otherFile = new File(['data'], other.name)
    const models = [lora, other]
    const upload = vi
      .spyOn(modelFileUploadApi, 'uploadModelFile')
      .mockResolvedValue({ ok: false, reason: 'unsupportedFile' })
    const store = await prepared(
      models,
      ['loras'],
      [
        [lora.name, loraFile.size],
        [other.name, otherFile.size]
      ]
    )
    store.choose(lora, loraFile)
    store.choose(other, otherFile)

    await store.start(models)

    expect(store.blockedBy(other)).toBe('fileType')
    expect(upload).not.toHaveBeenCalled()
  })

  it('clears readiness while the next dialog loads and ignores the older reply', async () => {
    const store = await prepared()
    let finishFirst: (folders: string[]) => void = () => {}
    vi.mocked(localModelUploadApi.readCloudUploadFolders)
      .mockImplementationOnce(
        () => new Promise((resolve) => (finishFirst = resolve))
      )
      .mockResolvedValueOnce(['checkpoints'])

    const first = store.prepare([lora])
    expect(store.uploadFolders).toBeNull()
    expect(store.sizeOf(lora)).toBeUndefined()
    await store.prepare([ckpt])
    finishFirst(['loras'])
    await first

    expect(store.canTake(ckpt)).toBe(true)
    expect(store.canTake(lora)).toBe(false)
  })

  it('uploads to Comfy Cloud, waits for the stored model, then checks again', async () => {
    vi.spyOn(modelFileUploadApi, 'uploadModelFile').mockResolvedValue({
      ok: true,
      taskId: TASK_ID
    })
    vi.mocked(localModelUploadApi.waitForStoredModel).mockResolvedValue({
      ok: true
    })
    const store = await prepared()
    store.choose(lora, loraFile)

    await store.start([lora])

    const [file, options] = vi.mocked(modelFileUploadApi.uploadModelFile).mock
      .calls[0]
    expect(file).toBe(loraFile)
    expect(options.tags).toEqual(['models', 'loras'])
    expect(localModelUploadApi.waitForStoredModel).toHaveBeenCalledWith(
      TASK_ID,
      expect.any(AbortSignal),
      expect.any(Function)
    )
    expect(store.upload).toEqual({ phase: 'done' })
    expect(check).toHaveBeenCalledOnce()
  })

  it('refreshes the rollout during a transfer and stops refreshing when it settles', async () => {
    vi.useFakeTimers()
    const revalidate = vi.fn(async () => true)
    vi.spyOn(rollout, 'bindLocalOpenOnCloudGrant').mockReturnValue({
      isCurrent: () => true,
      revalidate,
      allowsModelTransfer: async () => true
    })
    let finish!: () => void
    vi.spyOn(modelFileUploadApi, 'uploadModelFile').mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ ok: true, taskId: TASK_ID })
        })
    )
    vi.mocked(localModelUploadApi.waitForStoredModel).mockResolvedValue({
      ok: true
    })
    const store = await prepared()
    store.choose(lora, loraFile)

    const upload = store.start([lora])
    await vi.advanceTimersByTimeAsync(15_000)
    expect(revalidate).toHaveBeenCalledOnce()

    finish()
    await upload
    await vi.advanceTimersByTimeAsync(15_000)

    expect(revalidate).toHaveBeenCalledOnce()
  })

  it('retries only the models that did not reach Comfy Cloud', async () => {
    const upload = vi
      .spyOn(modelFileUploadApi, 'uploadModelFile')
      .mockResolvedValueOnce({ ok: true, taskId: TASK_ID })
      .mockResolvedValueOnce({ ok: false, reason: 'failed' })
      .mockResolvedValueOnce({ ok: true, taskId: TASK_ID })
    vi.mocked(localModelUploadApi.waitForStoredModel).mockResolvedValue({
      ok: true
    })
    const models = [lora, ckpt]
    useLocalModelUploadStore().reset(models)
    const store = await prepared(models)
    store.choose(lora, loraFile)
    store.choose(ckpt, ckptFile)

    await store.start(models)
    expect(store.upload).toMatchObject({ phase: 'failed' })
    expect(store.pickOf(lora).status).toBe('stored')
    store.reset(models)
    await store.prepare(models)
    expect(store.upload).toMatchObject({ phase: 'failed' })
    expect(store.pickOf(ckpt).status).toBe('chosen')
    await store.start(models)

    expect(upload.mock.calls.map(([file]) => file)).toEqual([
      loraFile,
      ckptFile,
      ckptFile
    ])
    expect(store.upload).toEqual({ phase: 'done' })
  })

  it('stops before the next file when the upload rollout is disabled and resumes only unsent files', async () => {
    const { flags } = useFeatureFlags()
    const upload = vi
      .spyOn(modelFileUploadApi, 'uploadModelFile')
      .mockResolvedValue({ ok: true, taskId: TASK_ID })
    vi.mocked(localModelUploadApi.waitForStoredModel)
      .mockImplementationOnce(async () => {
        Object.assign(flags, { openOnCloudModelUploadEnabled: false })
        return { ok: true }
      })
      .mockResolvedValue({ ok: true })
    const models = [lora, ckpt]
    const store = await prepared(models)
    store.choose(lora, loraFile)
    store.choose(ckpt, ckptFile)

    await store.start(models)
    await store.start(models)

    expect(upload.mock.calls.map(([file]) => file)).toEqual([loraFile])
    expect(store.upload).toEqual({
      phase: 'failed',
      reason: 'featureDisabled',
      models
    })
    expect(store.pickOf(lora).status).toBe('stored')
    expect(store.pickOf(ckpt).status).toBe('chosen')
    expect(store.retryBatches).toEqual([models])

    Object.assign(flags, { openOnCloudModelUploadEnabled: true })
    await store.start(models)

    expect(upload.mock.calls.map(([file]) => file)).toEqual([
      loraFile,
      ckptFile
    ])
    expect(store.upload).toEqual({ phase: 'done' })
  })

  it('finishes a staged file during rollback and leaves unsent files queued', async () => {
    const { flags } = useFeatureFlags()
    const staged = { uploadId: 'staged-upload' }
    const transfer = vi
      .spyOn(modelFileUploadApi, 'uploadModelFile')
      .mockImplementationOnce(async (_file, options) => {
        options.onCompleting?.(staged)
        Object.assign(flags, { openOnCloudModelUploadEnabled: false })
        return { ok: false, reason: 'failed' }
      })
      .mockResolvedValue({ ok: true, taskId: TASK_ID })
    vi.mocked(localModelUploadApi.waitForStoredModel).mockResolvedValue({
      ok: true
    })
    const models = [lora, ckpt]
    const store = await prepared(models)
    store.choose(lora, loraFile)
    store.choose(ckpt, ckptFile)

    await store.start(models)
    expect(store.upload).toMatchObject({ reason: 'storagePending' })
    expect(store.canFinish(models)).toBe(true)
    await store.start(models)

    expect(transfer.mock.calls.map(([file]) => file)).toEqual([
      loraFile,
      loraFile
    ])
    expect(transfer.mock.calls[1][1].resumeFrom).toBe(staged)
    expect(store.pickOf(lora).status).toBe('stored')
    expect(store.pickOf(ckpt).status).toBe('chosen')
    expect(store.retryBatches).toEqual([models])
    expect(store.canFinish(models)).toBe(false)
    expect(readCloudMissingModels).not.toHaveBeenCalled()

    Object.assign(flags, { openOnCloudModelUploadEnabled: true })
    await store.start(models)

    expect(transfer.mock.calls.map(([file]) => file)).toEqual([
      loraFile,
      loraFile,
      ckptFile
    ])
    expect(store.upload).toEqual({ phase: 'done' })
  })

  it('requires choosing a stored model again when a new Cloud check lists it as missing', async () => {
    vi.spyOn(modelFileUploadApi, 'uploadModelFile').mockResolvedValue({
      ok: true,
      taskId: TASK_ID
    })
    vi.mocked(localModelUploadApi.waitForStoredModel).mockResolvedValue({
      ok: true
    })
    const initialModels = [lora]
    useLocalModelUploadStore().reset(initialModels)
    const store = await prepared(initialModels)
    store.choose(lora, loraFile)
    await store.start(initialModels)
    expect(store.pickOf(lora).status).toBe('stored')

    const missingAgain = [lora, ckpt]
    store.reset(missingAgain, { freshVerdict: true })
    await store.prepare(missingAgain)
    store.choose(ckpt, ckptFile)

    expect(store.pickOf(lora).status).toBe('unchosen')
    expect(store.canUpload(missingAgain)).toBe(false)
    store.choose(lora, loraFile)
    expect(store.canUpload(missingAgain)).toBe(true)
  })

  it('finishes a previously submitted file before a new transfer can fail', async () => {
    const transfer = vi
      .spyOn(modelFileUploadApi, 'uploadModelFile')
      .mockResolvedValueOnce({ ok: true, taskId: TASK_ID })
      .mockResolvedValueOnce({ ok: false, reason: 'storageLimit' })
    const wait = vi
      .mocked(localModelUploadApi.waitForStoredModel)
      .mockResolvedValueOnce({ ok: false, reason: 'storagePending' })
      .mockResolvedValueOnce({ ok: true })
    const store = await prepared([ckpt])
    store.choose(ckpt, ckptFile)
    await store.start([ckpt])

    const models = [lora, ckpt]
    await prepared(models)
    store.choose(lora, loraFile)
    await store.start(models)

    expect(store.upload).toMatchObject({ reason: 'storageLimit', models })
    expect(store.pickOf(ckpt).status).toBe('stored')
    expect(transfer.mock.calls.map(([file]) => file)).toEqual([
      ckptFile,
      loraFile
    ])
    expect(wait).toHaveBeenCalledTimes(2)
  })

  it('finishes an accepted file despite an unavailable second file and lets a fresh missing verdict replace it', async () => {
    const staged = { uploadId: 'staged-upload' }
    const transfer = vi
      .spyOn(modelFileUploadApi, 'uploadModelFile')
      .mockImplementationOnce(async (_file, options) => {
        options.onCompleting?.(staged)
        return { ok: false, reason: 'failed' }
      })
      .mockResolvedValueOnce({ ok: true, taskId: TASK_ID })
    vi.mocked(localModelUploadApi.waitForStoredModel).mockResolvedValue({
      ok: true
    })
    const models = [lora, ckpt]
    const store = await prepared(models)
    store.choose(lora, loraFile)
    store.choose(ckpt, ckptFile)
    await store.start(models)
    await prepared(models, ['loras'], [[lora.name, loraFile.size]])

    expect(store.canSendAll(models)).toBe(false)
    expect(store.canUpload(models)).toBe(true)
    await store.start(models)
    expect(transfer.mock.calls.map(([file]) => file)).toEqual([
      loraFile,
      loraFile
    ])
    expect(transfer.mock.calls[1][1].resumeFrom).toBe(staged)
    expect(store.pickOf(lora).status).toBe('stored')
    expect(store.retryBatches).toEqual([models])
    expect(readCloudMissingModels).not.toHaveBeenCalled()

    store.reset([lora], { freshVerdict: true })
    expect(store.pickOf(lora).status).toBe('unchosen')
    expect(store.retryBatches).toEqual([models])
  })

  it('stops the upload and sends nothing more when the workspace changes', async () => {
    const routes: string[] = []
    vi.mocked(localModelUploadApi.cloudUploadRequest).mockImplementation(
      async (route) => {
        routes.push(route)
        return new Response()
      }
    )
    vi.spyOn(modelFileUploadApi, 'uploadModelFile').mockImplementation(
      async (_file, options) => {
        setWorkspace('ws-2')
        await options.request?.('/assets/uploads', {}).catch(() => undefined)
        return { ok: false, reason: 'cancelled' }
      }
    )
    const store = await prepared()
    store.choose(lora, loraFile)

    await store.start([lora])

    expect(routes).toEqual([])
    expect(store.upload).toEqual({ phase: 'failed', reason: 'accountChanged' })
    expect(check).not.toHaveBeenCalled()
  })

  it('clears stored models and ignores a late task when the workspace changes', async () => {
    vi.spyOn(modelFileUploadApi, 'uploadModelFile').mockResolvedValue({
      ok: true,
      taskId: TASK_ID
    })
    vi.mocked(localModelUploadApi.waitForStoredModel)
      .mockResolvedValueOnce({ ok: true })
      .mockImplementationOnce(async () => {
        setWorkspace('ws-2')
        return { ok: true }
      })
    const store = await prepared([lora, ckpt])
    store.choose(lora, loraFile)
    store.choose(ckpt, ckptFile)

    await store.start([lora, ckpt])

    expect(store.upload).toEqual({ phase: 'failed', reason: 'accountChanged' })
    expect(store.pickOf(lora).status).toBe('unchosen')
    expect(store.pickOf(ckpt).status).toBe('unchosen')
    expect(check).not.toHaveBeenCalled()
  })

  it('reports an account change after the user already clicked cancel', async () => {
    let finish: (result: ModelFileUploadResult) => void = () => {}
    vi.spyOn(modelFileUploadApi, 'uploadModelFile').mockImplementation(
      () => new Promise((resolve) => (finish = resolve))
    )
    const store = await prepared()
    store.choose(lora, loraFile)
    const started = store.start([lora])

    store.cancel()
    setWorkspace('ws-2')
    finish({ ok: false, reason: 'cancelled' })
    await started

    expect(store.upload).toEqual({ phase: 'failed', reason: 'accountChanged' })
  })

  it('reports progress across the whole upload', async () => {
    let finish!: (result: ModelFileUploadResult) => void
    vi.spyOn(modelFileUploadApi, 'uploadModelFile').mockImplementation(
      (_file, options) => {
        options.onProgress(5)
        return new Promise((resolve) => (finish = resolve))
      }
    )
    const store = await prepared()
    store.choose(lora, loraFile)

    const started = store.start([lora])

    expect(store.isUploading).toBe(true)
    expect(store.percent).toBe(50)
    finish({ ok: false, reason: 'cancelled' })
    await started
  })

  it('keeps tracking an accepted storage task after a cancellation attempt', async () => {
    vi.spyOn(modelFileUploadApi, 'uploadModelFile').mockResolvedValue({
      ok: true,
      taskId: TASK_ID
    })
    let finish: () => void = () => {}
    vi.mocked(localModelUploadApi.waitForStoredModel).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => resolve({ ok: true })
        })
    )
    const store = await prepared()
    const models = [lora]
    store.choose(lora, loraFile)

    const started = store.start(models)
    await vi.waitFor(() => expect(store.canCancel).toBe(false))
    expect(store.activeModels).toEqual(models)
    store.cancel()
    finish()
    await started

    expect(store.upload).toEqual({ phase: 'done' })
    expect(store.pickOf(lora).status).toBe('stored')
    expect(store.activeModels).toBeUndefined()
    expect(check).toHaveBeenCalledOnce()
  })

  it('resumes the accepted task after a polling timeout without transferring again', async () => {
    const transfer = vi
      .spyOn(modelFileUploadApi, 'uploadModelFile')
      .mockResolvedValue({ ok: true, taskId: TASK_ID })
    const poll = vi
      .mocked(localModelUploadApi.waitForStoredModel)
      .mockResolvedValueOnce({ ok: false, reason: 'storagePending' })
      .mockResolvedValueOnce({ ok: true })
    const models = [lora]
    const store = await prepared(models)
    store.choose(lora, loraFile)
    await store.start(models)
    expect(store.upload).toEqual({
      phase: 'failed',
      reason: 'storagePending',
      message: undefined,
      models
    })
    expect(store.activeModels).toEqual(models)

    await useCloudWorkflowCheckStore().check()
    store.reset([ckpt])
    expect(store.activeModels).toEqual(models)
    expect(store.pickOf(lora).status).toBe('submitted')
    store.reset([lora])
    await store.prepare([lora])
    await store.start([lora])

    expect(transfer).toHaveBeenCalledOnce()
    expect(poll.mock.calls.map(([id]) => id)).toEqual([TASK_ID, TASK_ID])
    expect(store.pickOf(lora).status).toBe('stored')
  })

  it('resumes a partially stored batch when the upload folders are unavailable', async () => {
    const transfer = vi
      .spyOn(modelFileUploadApi, 'uploadModelFile')
      .mockResolvedValueOnce({ ok: true, taskId: 'first-task' })
      .mockResolvedValueOnce({ ok: true, taskId: 'second-task' })
    const poll = vi
      .mocked(localModelUploadApi.waitForStoredModel)
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false, reason: 'storagePending' })
      .mockResolvedValueOnce({ ok: true })
    const models = [lora, ckpt]
    const store = await prepared(models)
    store.choose(lora, loraFile)
    store.choose(ckpt, ckptFile)
    await store.start(models)

    expect(store.pickOf(lora).status).toBe('stored')
    expect(store.pickOf(ckpt).status).toBe('submitted')
    await prepared(models, [], [])

    store.choose(lora, loraFile)
    expect(store.pickOf(lora).status).toBe('stored')
    expect(models.every(store.canTake)).toBe(true)
    expect(store.canUpload(models)).toBe(true)
    await store.start(models)

    expect(transfer).toHaveBeenCalledTimes(2)
    expect(poll.mock.calls.map(([id]) => id)).toEqual([
      'first-task',
      'second-task',
      'second-task'
    ])
    expect(store.upload).toEqual({ phase: 'done' })
  })

  it.for([
    { reason: 'failed', expected: 'storagePending' },
    { reason: 'accessDenied', expected: 'accessDenied' },
    { reason: 'planUnavailable', expected: 'planUnavailable' }
  ] as const)(
    'retries the same staged upload after $reason',
    async ({ reason, expected }) => {
      const staged = { uploadId: 'staged-upload', resumed: true }
      const transfer = vi
        .spyOn(modelFileUploadApi, 'uploadModelFile')
        .mockImplementationOnce(async (_file, options) => {
          options.onCompleting?.(staged)
          return { ok: false, reason }
        })
        .mockResolvedValueOnce({ ok: true, taskId: TASK_ID })
      vi.mocked(localModelUploadApi.waitForStoredModel).mockResolvedValue({
        ok: true
      })
      const models = [lora]
      const store = await prepared(models)
      store.choose(lora, loraFile)

      await store.start(models)
      expect(store.upload).toMatchObject({
        phase: 'failed',
        reason: expected
      })
      expect(store.pickOf(lora)).toEqual({
        status: 'staged',
        file: loraFile,
        staged
      })

      await useCloudWorkflowCheckStore().check()
      store.reset([ckpt])
      store.reset(models)
      await store.prepare(models)
      await store.start(models)

      expect(transfer.mock.calls[1][1].resumeFrom).toBe(staged)
      expect(store.pickOf(lora).status).toBe('stored')
    }
  )

  it('preserves the staged upload when Cloud refuses completion before the client sees rollback', async () => {
    const staged = { uploadId: 'staged-upload' }
    const upload = vi
      .spyOn(modelFileUploadApi, 'uploadModelFile')
      .mockImplementationOnce(async (_file, options) => {
        options.onCompleting?.(staged)
        return { ok: false, reason: 'featureDisabled' }
      })
      .mockResolvedValueOnce({ ok: true, taskId: TASK_ID })
    vi.mocked(localModelUploadApi.waitForStoredModel).mockResolvedValue({
      ok: true
    })
    const store = await prepared()
    store.choose(lora, loraFile)

    await store.start([lora])

    expect(upload).toHaveBeenCalledOnce()
    expect(store.upload).toMatchObject({
      phase: 'failed',
      reason: 'featureDisabled'
    })
    expect(store.pickOf(lora).status).toBe('staged')
    expect(localModelUploadApi.waitForStoredModel).not.toHaveBeenCalled()

    await store.start([lora])

    expect(upload.mock.calls[1][1].resumeFrom).toBe(staged)
    expect(store.pickOf(lora).status).toBe('stored')
  })

  it.for([true, false])(
    'checks model availability after a task disappears (%s)',
    async (available) => {
      const transfer = vi
        .spyOn(modelFileUploadApi, 'uploadModelFile')
        .mockResolvedValueOnce({ ok: true, taskId: TASK_ID })
      vi.mocked(localModelUploadApi.waitForStoredModel).mockResolvedValue({
        ok: false,
        reason: 'taskUnavailable'
      })
      vi.mocked(readCloudMissingModels).mockResolvedValue(
        available ? [] : [lora]
      )
      const models = [lora]
      const store = await prepared(models)
      store.choose(lora, loraFile)

      await store.start(models)

      expect(readCloudMissingModels).toHaveBeenCalledWith(
        [lora],
        'ws-1',
        expect.any(AbortSignal)
      )
      expect(transfer).toHaveBeenCalledOnce()
      expect(store.pickOf(lora).status).toBe(available ? 'stored' : 'chosen')
      expect(store.upload.phase).toBe(available ? 'done' : 'failed')
    }
  )

  it('keeps a failed transfer recoverable while checking a different workflow', async () => {
    vi.spyOn(modelFileUploadApi, 'uploadModelFile').mockResolvedValueOnce({
      ok: false,
      reason: 'storageLimit',
      message: 'Workspace model storage is full.'
    })
    const models = [lora]
    const store = await prepared(models)
    store.choose(lora, loraFile)

    await store.start(models)
    await useCloudWorkflowCheckStore().check()
    store.reset([ckpt])
    await store.prepare(models)

    expect(store.activeModels).toEqual(models)
    expect(store.pickOf(lora).status).toBe('chosen')
    expect(store.upload).toMatchObject({
      reason: 'storageLimit',
      message: 'Workspace model storage is full.'
    })
  })

  it('keeps stored files and confirms the original batch after switching workflows', async () => {
    const transfer = vi
      .spyOn(modelFileUploadApi, 'uploadModelFile')
      .mockResolvedValue({ ok: true, taskId: TASK_ID })
    vi.mocked(localModelUploadApi.waitForStoredModel).mockResolvedValue({
      ok: true
    })
    vi.mocked(readCloudMissingModels)
      .mockResolvedValueOnce([lora])
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([])
    const models = [lora]
    const store = await prepared(models)
    store.choose(lora, loraFile)

    await store.start(models)
    expect(store.upload).toMatchObject({
      phase: 'failed',
      reason: 'confirmationPending'
    })
    expect(store.retryBatches).toEqual([models])
    store.reset([...models], { freshVerdict: true })
    expect(store.pickOf(lora).status).toBe('stored')

    store.reset([ckpt], { freshVerdict: true })
    const checkStore = useCloudWorkflowCheckStore()
    checkStore.state = {
      phase: 'answered',
      verdict: { kind: 'missing', gaps: { models, nodePacks: [] } }
    }
    await prepared(models, [], [])
    await store.start(models, { refreshWorkflow: false })
    expect(store.retryBatches).toEqual([models])
    await store.start(models, { refreshWorkflow: false })

    expect(transfer).toHaveBeenCalledOnce()
    expect(
      vi.mocked(readCloudMissingModels).mock.calls.map(([batch]) => batch)
    ).toEqual([models, models, models])
    expect(store.retryBatches).toEqual([])
    expect(checkStore.state).toEqual({ phase: 'idle' })
    expect(check).not.toHaveBeenCalled()

    check.mockRestore()
    Object.assign(useFeatureFlags().flags, {
      openOnCloudModelUploadEnabled: false
    })
    await checkStore.check()
    expect(checkCloudCompatibility).toHaveBeenLastCalledWith({
      workspaceId: 'ws-1',
      models
    })

    setWorkspace('ws-2')
    await checkStore.check()
    expect(checkCloudCompatibility).toHaveBeenLastCalledWith(undefined)
  })

  it('preserves pending confirmation across another upload and a fresh verdict', async () => {
    const transfer = vi
      .spyOn(modelFileUploadApi, 'uploadModelFile')
      .mockResolvedValue({ ok: true, taskId: TASK_ID })
    vi.mocked(localModelUploadApi.waitForStoredModel).mockResolvedValue({
      ok: true
    })
    vi.mocked(readCloudMissingModels).mockResolvedValueOnce([lora])
    const store = await prepared()
    store.choose(lora, loraFile)
    await store.start([lora])
    expect(store.upload).toMatchObject({ reason: 'confirmationPending' })

    store.reset([ckpt])
    await store.prepare([ckpt])
    store.choose(ckpt, ckptFile)
    await store.start([ckpt])
    expect(store.upload).toEqual({ phase: 'done' })

    store.reset([lora], { freshVerdict: true })
    expect(store.canFinish([lora])).toBe(true)
    await store.start([lora])

    expect(transfer).toHaveBeenCalledTimes(2)
    expect(store.retryBatches).toEqual([])
  })

  it('reselects only the files Cloud reports missing when confirmation keeps failing', async () => {
    const transfer = vi
      .spyOn(modelFileUploadApi, 'uploadModelFile')
      .mockResolvedValue({ ok: true, taskId: TASK_ID })
    vi.mocked(localModelUploadApi.waitForStoredModel).mockResolvedValue({
      ok: true
    })
    vi.mocked(readCloudMissingModels)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce([lora])
    const models = [lora, ckpt]
    const store = await prepared(models)
    store.choose(lora, loraFile)
    store.choose(ckpt, ckptFile)
    await store.start(models)
    store.reselectUnconfirmedFiles()
    expect(store.pickOf(lora).status).toBe('stored')

    await store.start(models)
    expect(transfer).toHaveBeenCalledTimes(2)
    expect(store.upload).toMatchObject({ unconfirmedModels: [lora] })

    store.reselectUnconfirmedFiles()
    expect(store.pickOf(lora).status).toBe('unchosen')
    expect(store.pickOf(ckpt).status).toBe('stored')
    store.choose(lora, loraFile)
    await store.start(models)

    expect(transfer.mock.calls.map(([file]) => file)).toEqual([
      loraFile,
      ckptFile,
      loraFile
    ])
    expect(store.upload.phase).toBe('done')
  })

  it('keeps an unfinished storage task recoverable after a different upload succeeds', async () => {
    const otherTaskId = 'f72bc0f1-9ee4-437c-a18f-2abcaa51ebe8'
    const transfer = vi
      .spyOn(modelFileUploadApi, 'uploadModelFile')
      .mockResolvedValueOnce({ ok: true, taskId: TASK_ID })
      .mockResolvedValueOnce({ ok: true, taskId: otherTaskId })
    const waitForStoredModel = vi
      .mocked(localModelUploadApi.waitForStoredModel)
      .mockResolvedValueOnce({ ok: false, reason: 'storagePending' })
      .mockResolvedValue({ ok: true })
    const store = await prepared()
    store.choose(lora, loraFile)
    await store.start([lora])

    store.reset([ckpt])
    await store.prepare([ckpt])
    store.choose(ckpt, ckptFile)
    await store.start([ckpt])

    expect(store.activeModels).toEqual([lora])
    await store.start([lora])

    expect(transfer).toHaveBeenCalledTimes(2)
    expect(waitForStoredModel).toHaveBeenLastCalledWith(
      TASK_ID,
      expect.any(AbortSignal),
      expect.any(Function)
    )
    expect(store.activeModels).toBeUndefined()
  })

  it('keeps a failed batch recoverable when another upload succeeds before it is retried', async () => {
    const transfer = vi
      .spyOn(modelFileUploadApi, 'uploadModelFile')
      .mockResolvedValueOnce({ ok: false, reason: 'storageLimit' })
      .mockResolvedValue({ ok: true, taskId: TASK_ID })
    vi.mocked(localModelUploadApi.waitForStoredModel).mockResolvedValue({
      ok: true
    })
    const store = await prepared()
    store.choose(lora, loraFile)
    await store.start([lora])

    store.reset([ckpt])
    await store.prepare([ckpt])
    store.choose(ckpt, ckptFile)
    await store.start([ckpt])

    expect(store.activeModels).toEqual([lora])
    store.reset([lora])
    await store.prepare([lora])
    await store.start([lora])

    expect(transfer.mock.calls[2][0]).toBe(loraFile)
    expect(store.activeModels).toBeUndefined()
  })

  it('keeps the upload recoverable when Cloud cancels the storage task', async () => {
    vi.spyOn(modelFileUploadApi, 'uploadModelFile').mockResolvedValueOnce({
      ok: true,
      taskId: TASK_ID
    })
    vi.mocked(localModelUploadApi.waitForStoredModel).mockResolvedValueOnce({
      ok: false,
      reason: 'cancelled'
    })
    const store = await prepared()
    store.choose(lora, loraFile)

    await store.start([lora])
    store.reset([ckpt])

    expect(store.activeModels).toEqual([lora])
    await store.prepare([lora])
    expect(store.canUpload([lora])).toBe(true)
  })

  it('stops on cancel and does not check again', async () => {
    vi.spyOn(modelFileUploadApi, 'uploadModelFile').mockImplementation(
      (_file, options) =>
        new Promise((resolve) =>
          options.signal.addEventListener('abort', () =>
            resolve({ ok: false, reason: 'cancelled' })
          )
        )
    )
    const store = await prepared()
    store.choose(lora, loraFile)

    const started = store.start([lora])
    store.cancel()
    await started

    expect(store.upload).toMatchObject({ phase: 'failed', reason: 'cancelled' })
    expect(check).not.toHaveBeenCalled()
  })

  it('resumes the remaining file after cancelling a partially stored batch', async () => {
    const models = [lora, ckpt]
    let notifySecondStarted!: () => void
    const secondStarted = new Promise<void>((resolve) => {
      notifySecondStarted = resolve
    })
    const transfer = vi
      .spyOn(modelFileUploadApi, 'uploadModelFile')
      .mockResolvedValueOnce({ ok: true, taskId: TASK_ID })
      .mockImplementationOnce(
        (_file, options) =>
          new Promise((resolve) => {
            options.signal.addEventListener('abort', () =>
              resolve({ ok: false, reason: 'cancelled' })
            )
            notifySecondStarted()
          })
      )
      .mockResolvedValueOnce({ ok: true, taskId: TASK_ID })
    vi.mocked(localModelUploadApi.waitForStoredModel).mockResolvedValue({
      ok: true
    })
    const store = await prepared(models)
    store.choose(lora, loraFile)
    store.choose(ckpt, ckptFile)
    const upload = store.start(models)
    await secondStarted

    store.cancel()
    await upload
    store.reset([nested])
    expect(store.activeModels).toEqual(models)
    await store.prepare(models)
    await store.start(models)

    expect(transfer.mock.calls.map(([file]) => file)).toEqual([
      loraFile,
      ckptFile,
      ckptFile
    ])
    expect(store.activeModels).toBeUndefined()
  })

  it("keeps Comfy Cloud's reason when it refuses the upload", async () => {
    vi.spyOn(modelFileUploadApi, 'uploadModelFile').mockResolvedValue({
      ok: false,
      reason: 'privateModelsDisabled'
    })
    const store = await prepared()
    store.choose(lora, loraFile)

    await store.start([lora])

    expect(store.upload).toMatchObject({
      phase: 'failed',
      reason: 'privateModelsDisabled'
    })
    expect(localModelUploadApi.waitForStoredModel).not.toHaveBeenCalled()
  })

  it.for([
    {
      label: 'Comfy Cloud cannot store the uploaded model',
      stored: () =>
        Promise.resolve({
          ok: false as const,
          reason: 'failed' as const,
          message: 'Not a safetensors file'
        }),
      expected: { reason: 'failed', message: 'Not a safetensors file' }
    },
    {
      label: 'waiting for the stored model throws',
      stored: () => Promise.reject(new Error('task poll broke')),
      expected: { reason: 'failed' }
    }
  ])('fails cleanly when $label', async ({ stored, expected }) => {
    vi.spyOn(modelFileUploadApi, 'uploadModelFile').mockResolvedValue({
      ok: true,
      taskId: TASK_ID
    })
    vi.mocked(localModelUploadApi.waitForStoredModel).mockImplementation(stored)
    const store = await prepared()
    store.choose(lora, loraFile)

    await store.start([lora])

    expect(store.upload).toMatchObject({ phase: 'failed', ...expected })
    expect(store.isUploading).toBe(false)
    expect(check).not.toHaveBeenCalled()
  })
})

it('rechecks when the workspace changes and ignores the old workspace result', async () => {
  setWorkspace('ws-1')
  const store = useCloudWorkflowCheckStore()
  let finish: (result: CloudWorkflowCheckResult) => void = () => {}
  vi.mocked(checkCloudCompatibility)
    .mockImplementationOnce(() => new Promise((resolve) => (finish = resolve)))
    .mockResolvedValueOnce({ kind: 'canOpen' })

  const first = store.check()
  setWorkspace('ws-2')
  await vi.waitFor(() =>
    expect(store.state).toEqual({
      phase: 'answered',
      verdict: { kind: 'canOpen' }
    })
  )
  finish({ kind: 'missing', gaps: { nodePacks: [], models: [lora] } })
  await first

  expect(store.state).toEqual({
    phase: 'answered',
    verdict: { kind: 'canOpen' }
  })
})
