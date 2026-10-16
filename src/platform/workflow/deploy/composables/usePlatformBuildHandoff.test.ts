import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadBlob } from '@/base/common/downloadUtil'
import { useToast } from '@/components/ui/toast/toastStore'
import en from '@/locales/en/main.json'
import { LGraph } from '@/lib/litegraph/src/litegraph'
import * as distribution from '@/platform/distribution/types'
import { reportError } from '@/platform/telemetry/reportError'
import { useWorkflowService } from '@/platform/workflow/core/services/workflowService'
import { usePlatformBuildHandoff } from '@/platform/workflow/deploy/composables/usePlatformBuildHandoff'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

vi.mock(import('@/platform/distribution/types'), { spy: true })
vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))
vi.mock(import('@/platform/telemetry/reportError'))
vi.mock(import('@/platform/workflow/core/services/workflowService'))
vi.mock(import('@/base/common/downloadUtil'), () => ({
  downloadBlob: vi.fn()
}))

const PLATFORM = 'https://platform.comfy.org'
const IMPORT_STEP = PLATFORM + '/profile/builds/new?step=import'

const flushPromises = () => vi.advanceTimersByTimeAsync(0)

function ready(overrides: Partial<MessageEventInit> = {}) {
  const url = new URL(String(vi.mocked(window.open).mock.calls.at(-1)?.[0]))
  const nonce = url.searchParams.get('handoff')
  window.dispatchEvent(
    new MessageEvent('message', {
      source: window,
      origin: PLATFORM,
      data: { type: 'comfy-build-handoff:ready', nonce },
      ...overrides
    })
  )
  return nonce
}

describe('usePlatformBuildHandoff', () => {
  beforeEach(() => {
    vi.spyOn(distribution, 'isDesktop', 'get').mockReturnValue(false)
    useWorkflowStore().activeWorkflow = fromPartial({
      fullFilename: 'portrait-upscale.app.json'
    })
    vi.mocked(useWorkflowService().prepareWorkflowJson).mockReturnValue(
      new LGraph().serialize()
    )
    vi.spyOn(window, 'open').mockReturnValue(window)
    vi.spyOn(window, 'postMessage').mockImplementation(() => {})
  })

  it('opens the wizard synchronously and sends the current workflow once', async () => {
    const workflow = new LGraph().serialize()
    vi.mocked(useWorkflowService().prepareWorkflowJson).mockReturnValue(
      workflow
    )

    const opening = usePlatformBuildHandoff().open()

    expect(window.open).toHaveBeenCalledWith(
      expect.stringMatching(
        /^https:\/\/platform.comfy.org\/profile\/builds\/new\?step=import&handoff=/
      ),
      '_blank'
    )
    expect(await opening).toBe(true)
    const nonce = ready()
    ready()
    await flushPromises()

    expect(window.postMessage).toHaveBeenCalledExactlyOnceWith(
      {
        type: 'comfy-build-handoff:workflow',
        nonce,
        filename: 'portrait-upscale.app.json',
        workflow: expect.objectContaining({ nodes: workflow.nodes })
      },
      PLATFORM
    )
  })

  it.for([
    { source: null },
    { origin: 'https://other.example' },
    { data: { type: 'comfy-build-handoff:ready', nonce: 'wrong' } },
    { data: { type: 'wrong' } }
  ])('rejects an unrelated ready message: %j', async (overrides) => {
    await usePlatformBuildHandoff().open()

    ready(overrides)
    await flushPromises()

    expect(window.postMessage).not.toHaveBeenCalled()
    ready()
    await flushPromises()
    expect(window.postMessage).toHaveBeenCalledOnce()
  })

  it.for([
    { elapsed: 59_000, sent: true },
    { elapsed: 60_000, sent: false }
  ])(
    'accepts ready until the deadline: $elapsed',
    async ({ elapsed, sent }) => {
      await usePlatformBuildHandoff().open()
      await vi.advanceTimersByTimeAsync(elapsed)

      ready()
      await flushPromises()

      expect(vi.mocked(window.postMessage).mock.calls.length).toBe(Number(sent))
    }
  )

  it('creates a different handoff for each click', async () => {
    const handoff = usePlatformBuildHandoff()
    await handoff.open()
    const first = ready()
    await handoff.open()
    const second = ready()
    await flushPromises()
    expect(first).not.toBe(second)
  })

  it.for(['serialization', 'validation'] as const)(
    'shows a preparation failure for %s and opens plain import',
    async (failure) => {
      if (failure === 'serialization') {
        vi.mocked(useWorkflowService().prepareWorkflowJson).mockImplementation(
          () => {
            throw new Error('Could not serialize')
          }
        )
      } else {
        vi.mocked(useWorkflowService().prepareWorkflowJson).mockReturnValue(
          fromPartial({})
        )
      }
      const navigate = vi
        .spyOn(window.location, 'href', 'set')
        .mockImplementation(() => {})

      await usePlatformBuildHandoff().open()
      await flushPromises()
      ready()
      await flushPromises()

      expect(navigate).toHaveBeenCalledWith(IMPORT_STEP)
      expect(window.postMessage).not.toHaveBeenCalled()
      expect(useToast().toasts).toContainEqual(
        expect.objectContaining({
          kind: 'error',
          title: en.deployToComfyApi.workflowTransferFailed
        })
      )
      expect(reportError).toHaveBeenCalledOnce()
    }
  )

  it('downloads the workflow and supplies the import link when a popup is blocked', async () => {
    vi.mocked(window.open).mockReturnValue(null)

    expect(await usePlatformBuildHandoff().open()).toBe(false)

    expect(downloadBlob).toHaveBeenCalledWith(
      'portrait-upscale.app.json',
      expect.any(Blob)
    )
    const blob = vi.mocked(downloadBlob).mock.calls[0][1]
    expect(JSON.parse(await blob.text()).nodes).toEqual([])
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        title: en.deployToComfyApi.popupBlockedDownloadStarted,
        description: IMPORT_STEP
      })
    )
  })

  it('reports a failed fallback download and still supplies the builder link', async () => {
    vi.mocked(window.open).mockReturnValue(null)
    vi.mocked(downloadBlob).mockImplementation(() => {
      throw new Error('Download failed')
    })

    expect(await usePlatformBuildHandoff().open()).toBe(false)
    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        title: en.deployToComfyApi.popupBlocked,
        description: IMPORT_STEP
      })
    )
    expect(reportError).toHaveBeenCalledOnce()
  })

  it('downloads before handing Desktop off to the system browser', async () => {
    vi.spyOn(distribution, 'isDesktop', 'get').mockReturnValue(true)
    vi.mocked(window.open).mockImplementation(() => {
      expect(downloadBlob).toHaveBeenCalledWith(
        'portrait-upscale.app.json',
        expect.any(Blob)
      )
      return null
    })

    expect(await usePlatformBuildHandoff().open()).toBe(true)
    expect(window.open).toHaveBeenCalledWith(IMPORT_STEP, '_blank', 'noopener')
  })

  it('opens an empty builder when there is no active workflow', async () => {
    useWorkflowStore().activeWorkflow = null

    expect(await usePlatformBuildHandoff().open()).toBe(true)
    expect(window.open).toHaveBeenCalledWith(IMPORT_STEP, '_blank', 'noopener')
    expect(downloadBlob).not.toHaveBeenCalled()
  })
})
