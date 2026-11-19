import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as localModelUploadApi from '@/platform/openOnCloud/localModelUploadApi'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { modelFileUploadApi } from '@/platform/workspace/api/modelFileUploadApi'
import type { ModelFileUploadResult } from '@/platform/workspace/api/modelFileUploadApi'

import { useLocalModelUploadStore } from './localModelUploadStore'

vi.mock(import('@/platform/openOnCloud/localModelUploadApi'))
vi.mock(import('@comfyorg/telemetry/reportError'))
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/openOnCloud/cloudCompatibilityApi'))

const TASK_ID = '8c2d4e6f-1a3b-4c5d-9e7f-0a1b2c3d4e5f'
const lora = { folder: 'loras', name: 'retro_anime_style.safetensors' }
const loraFile = new File(['0123456789'], 'retro_anime_style.safetensors')

async function prepared(folders = ['loras', 'checkpoints']) {
  vi.mocked(localModelUploadApi.readCloudUploadFolders).mockResolvedValue(
    folders
  )
  vi.mocked(localModelUploadApi.readLocalModelSizes).mockResolvedValue(
    new Map([[lora.name, loraFile.size]])
  )
  const store = useLocalModelUploadStore()
  await store.prepare([lora])
  return store
}

describe('useLocalModelUploadStore', () => {
  let check: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
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

  it('offers no upload into a folder Comfy Cloud does not take', async () => {
    const store = await prepared(['checkpoints'])

    store.choose(lora, loraFile)

    expect(store.takesFolder('loras')).toBe(false)
    expect(store.canUpload([lora])).toBe(false)
  })

  it('uploads to Comfy Cloud, waits for the stored model, then checks again', async () => {
    vi.spyOn(modelFileUploadApi, 'uploadModelFile').mockImplementation(
      async (_file, options) => {
        options.onProgress(5)
        return { ok: true, taskId: TASK_ID }
      }
    )
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
    expect(options.request).toBe(localModelUploadApi.cloudUploadRequest)
    expect(localModelUploadApi.waitForStoredModel).toHaveBeenCalledWith(
      TASK_ID,
      expect.any(AbortSignal)
    )
    expect(store.upload).toEqual({ phase: 'done' })
    expect(check).toHaveBeenCalledOnce()
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

    expect(store.upload).toEqual({
      phase: 'failed',
      reason: 'cancelled',
      message: undefined
    })
    expect(check).not.toHaveBeenCalled()
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

  it('fails when Comfy Cloud cannot store the uploaded model', async () => {
    vi.spyOn(modelFileUploadApi, 'uploadModelFile').mockResolvedValue({
      ok: true,
      taskId: TASK_ID
    })
    vi.mocked(localModelUploadApi.waitForStoredModel).mockResolvedValue({
      ok: false,
      reason: 'failed',
      message: 'Not a safetensors file'
    })
    const store = await prepared()
    store.choose(lora, loraFile)

    await store.start([lora])

    expect(store.upload).toEqual({
      phase: 'failed',
      reason: 'failed',
      message: 'Not a safetensors file'
    })
    expect(check).not.toHaveBeenCalled()
  })
})
