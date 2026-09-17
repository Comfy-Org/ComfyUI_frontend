import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { usePlatformBuildHandoff } from '@/platform/workflow/deploy/composables/usePlatformBuildHandoff'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'

const distribution = vi.hoisted(() => ({ isCloud: true, isDesktop: false }))
vi.mock(import('@/platform/distribution/types'), () => distribution)

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

const fetchApi = vi.hoisted(() => vi.fn())
vi.mock<unknown>(import('@/scripts/api'), () => ({
  api: { fetchApi, addEventListener: vi.fn() }
}))

const exportWorkflow = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const saveWorkflow = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock<unknown>(
  import('@/platform/workflow/core/services/workflowService'),
  () => ({ useWorkflowService: () => ({ exportWorkflow, saveWorkflow }) })
)

const IMPORT_STEP = 'https://platform.comfy.org/profile/builds/new?step=import'

function listing(entries: { id: string; name: string }[]) {
  return fromPartial<Response>({
    ok: true,
    json: () => Promise.resolve({ data: entries })
  })
}

function setActiveWorkflow(overrides: Record<string, unknown> = {}) {
  useWorkflowStore().activeWorkflow = fromPartial({
    path: 'workflows/portrait-upscale.json',
    filename: 'portrait-upscale.json',
    isTemporary: false,
    isModified: false,
    ...overrides
  })
}

describe('usePlatformBuildHandoff', () => {
  let tab: { location: { href: string } }
  let open: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    distribution.isCloud = true
    distribution.isDesktop = false
    tab = { location: { href: '' } }
    open = vi
      .spyOn(window, 'open')
      .mockImplementation(() => fromPartial<Window>(tab))
    fetchApi.mockResolvedValue(
      listing([
        { id: 'wf_other', name: 'portrait-upscale-v2' },
        { id: 'wf_123', name: 'portrait-upscale' }
      ])
    )
  })

  it('opens the tab on the click, then sends it to the saved workflow', async () => {
    setActiveWorkflow()

    await usePlatformBuildHandoff().open()

    expect(open).toHaveBeenCalledWith('', '_blank')
    expect(fetchApi).toHaveBeenCalledWith(
      '/workflows?name=portrait-upscale&limit=50'
    )
    expect(tab.location.href).toBe(`${IMPORT_STEP}&workflow=wf_123`)
    expect(saveWorkflow).not.toHaveBeenCalled()
    expect(exportWorkflow).not.toHaveBeenCalled()
  })

  it('saves a changed workflow first so Cloud holds what the canvas shows', async () => {
    setActiveWorkflow({ isModified: true })

    await usePlatformBuildHandoff().open()

    expect(saveWorkflow).toHaveBeenCalledOnce()
    expect(tab.location.href).toBe(`${IMPORT_STEP}&workflow=wf_123`)
  })

  it.for([
    {
      reason: 'the save is cancelled',
      arrange: () => saveWorkflow.mockResolvedValueOnce(false)
    },
    {
      reason: 'Cloud has no workflow of that name',
      arrange: () => fetchApi.mockResolvedValue(listing([]))
    },
    {
      reason: 'the lookup fails',
      arrange: () =>
        fetchApi.mockResolvedValue(fromPartial<Response>({ ok: false }))
    }
  ])('falls back to the bare import step when $reason', async ({ arrange }) => {
    setActiveWorkflow({ isTemporary: true })
    arrange()

    await usePlatformBuildHandoff().open()

    expect(tab.location.href).toBe(IMPORT_STEP)
  })

  it('exports the workflow file for the drop zone when there is no Cloud copy', async () => {
    distribution.isCloud = false
    setActiveWorkflow({ path: 'workflows/sub/portrait-upscale.json' })

    await usePlatformBuildHandoff().open()

    expect(exportWorkflow).toHaveBeenCalledWith(
      'sub/portrait-upscale',
      'workflow'
    )
    expect(fetchApi).not.toHaveBeenCalled()
    expect(tab.location.href).toBe(IMPORT_STEP)
  })

  it('opens the resolved link in one go on Desktop, where new windows go to the system browser', async () => {
    distribution.isCloud = false
    distribution.isDesktop = true
    setActiveWorkflow()

    await usePlatformBuildHandoff().open()

    expect(open).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledWith(IMPORT_STEP, '_blank', 'noopener')
  })

  it('opens the resolved link directly when the popup was blocked', async () => {
    setActiveWorkflow()
    open.mockImplementation(() => null)

    await usePlatformBuildHandoff().open()

    expect(open).toHaveBeenLastCalledWith(
      `${IMPORT_STEP}&workflow=wf_123`,
      '_blank',
      'noopener'
    )
  })
})
