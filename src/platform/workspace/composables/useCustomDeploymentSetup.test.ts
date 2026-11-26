import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

import { useCustomDeploymentOffered } from '@/platform/workspace/composables/useCustomDeploymentOffered'
import { useCustomDeploymentSetup } from '@/platform/workspace/composables/useCustomDeploymentSetup'
import { useMissingNodeDeploymentOffer } from '@/platform/workspace/composables/useMissingNodeDeploymentOffer'
import { openWorkflowNeedsDeploymentDialog } from '@/platform/workspace/openCustomDeploymentDialog'
import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import { NEW_DEPLOYMENT_FOR_WORKFLOW } from '@/platform/workspace/platformFrame/platformFrameWaysIn'

vi.mock(import('@/platform/workspace/composables/useCustomDeploymentOffered'))
vi.mock(
  import('@/platform/workspace/composables/useMissingNodeDeploymentOffer')
)
vi.mock(import('@/platform/workspace/openCustomDeploymentDialog'))

type Offer = ReturnType<typeof useMissingNodeDeploymentOffer>['offer']['value']

const offer = ref<Offer>(null)

beforeEach(() => {
  offer.value = null
  vi.mocked(useMissingNodeDeploymentOffer).mockReturnValue({
    offer: computed(() => offer.value)
  } as ReturnType<typeof useMissingNodeDeploymentOffer>)
  vi.mocked(openWorkflowNeedsDeploymentDialog).mockResolvedValue(true)
})

describe('useCustomDeploymentSetup', () => {
  it('offers a custom deployment once no deployment runs the workflow', () => {
    vi.mocked(useCustomDeploymentOffered).mockImplementation((noneRunIt) =>
      computed(() => (typeof noneRunIt === 'function' ? noneRunIt() : false))
    )
    const { offered } = useCustomDeploymentSetup()

    expect(offered.value).toBe(false)

    offer.value = { kind: 'none' }

    expect(offered.value).toBe(true)
  })

  it('opens the Platform frame for a new deployment when it can', () => {
    vi.mocked(useCustomDeploymentOffered).mockReturnValue(computed(() => true))
    vi.spyOn(usePlatformFrameStore(), 'open').mockReturnValue(true)

    useCustomDeploymentSetup().setUp('errors_panel')

    expect(usePlatformFrameStore().open).toHaveBeenCalledWith(
      NEW_DEPLOYMENT_FOR_WORKFLOW,
      'errors_panel'
    )
    expect(openWorkflowNeedsDeploymentDialog).not.toHaveBeenCalled()
  })

  it('opens the custom deployment dialog when the frame is not available', () => {
    vi.mocked(useCustomDeploymentOffered).mockReturnValue(computed(() => true))
    vi.spyOn(usePlatformFrameStore(), 'open').mockReturnValue(false)

    useCustomDeploymentSetup().setUp('errors_panel')

    expect(openWorkflowNeedsDeploymentDialog).toHaveBeenCalledOnce()
  })
})
