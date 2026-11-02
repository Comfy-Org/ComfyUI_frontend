import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import {
  PROTOTYPE_CHECK_MS,
  PROTOTYPE_GAPS
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import {
  closeRunOnCloudDialog,
  openRunOnCloudDialog
} from '@/platform/openOnCloud/openRunOnCloudDialog'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useLocalSignInStore } from '@/platform/openOnCloud/stores/localSignInStore'
import {
  PROTOTYPE_UPLOAD_MS,
  useModelUploadStore
} from '@/platform/openOnCloud/stores/modelUploadStore'
import { defaultGraph } from '@/scripts/defaultGraph'

import CloudButton from './CloudButton.vue'

vi.mock(import('@/composables/useErrorHandling'))
vi.mock(import('@/platform/openOnCloud/openRunOnCloudDialog'), () => ({
  openRunOnCloudDialog: vi.fn(async () => {}),
  closeRunOnCloudDialog: vi.fn(() => true)
}))
vi.mock(import('@/platform/openOnCloud/serializeRootGraph'), () => ({
  serializeRootGraph: vi.fn(() => defaultGraph)
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderButton() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(CloudButton, { global: { plugins: [i18n] } })
  return user
}

function cloudButton() {
  return screen.getByTestId('cloud-button')
}

describe('CloudButton', () => {
  it('shows that it is checking while Comfy Cloud answers', async () => {
    const user = renderButton()
    expect(cloudButton()).toHaveAccessibleName('Run on Comfy Cloud')

    await user.hover(cloudButton())

    expect(cloudButton()).toHaveAccessibleName('Checking Comfy Cloud…')
    expect(cloudButton()).toHaveAttribute('aria-busy', 'true')

    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)

    expect(cloudButton()).toHaveAccessibleName('Run on Comfy Cloud')
    expect(cloudButton()).not.toHaveAttribute('aria-busy')
  })

  it('opens the modal at once when Comfy Cloud has answered', async () => {
    const user = renderButton()

    await user.hover(cloudButton())
    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)
    await user.click(cloudButton())

    expect(openRunOnCloudDialog).toHaveBeenCalledOnce()
  })

  it('a click while checking opens the modal when the answer arrives', async () => {
    const user = renderButton()

    await user.hover(cloudButton())
    await user.click(cloudButton())

    expect(openRunOnCloudDialog).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)

    expect(openRunOnCloudDialog).toHaveBeenCalledOnce()
  })

  it('a key press checks Comfy Cloud, then opens the modal with the answer', async () => {
    const user = renderButton()

    await user.tab()
    await user.keyboard('{Enter}')

    expect(cloudButton()).toHaveAccessibleName('Checking Comfy Cloud…')
    expect(openRunOnCloudDialog).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)

    expect(openRunOnCloudDialog).toHaveBeenCalledOnce()
  })

  it('closes the open modal while Comfy Cloud checks again, then reopens it with the answer', async () => {
    const user = renderButton()
    const checkStore = useCloudWorkflowCheckStore()
    await user.hover(cloudButton())
    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)
    await user.click(cloudButton())

    checkStore.prototypeScenario = 'checking'
    await vi.advanceTimersByTimeAsync(0)

    expect(closeRunOnCloudDialog).toHaveBeenCalledOnce()
    expect(cloudButton()).toHaveAccessibleName('Checking Comfy Cloud…')

    checkStore.prototypeScenario = 'nodePacksMissing'
    await vi.advanceTimersByTimeAsync(0)

    expect(openRunOnCloudDialog).toHaveBeenCalledTimes(2)
  })

  it('checks again after a sign-in, then reopens the modal with the answer', async () => {
    const user = renderButton()
    await user.hover(cloudButton())
    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)
    await user.click(cloudButton())

    useLocalSignInStore().signedIn = true
    await vi.advanceTimersByTimeAsync(0)

    expect(closeRunOnCloudDialog).toHaveBeenCalledOnce()
    expect(cloudButton()).toHaveAccessibleName('Checking Comfy Cloud…')

    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)

    expect(openRunOnCloudDialog).toHaveBeenCalledTimes(2)
  })

  it('keeps a running check when the button is clicked', async () => {
    const user = renderButton()

    await user.hover(cloudButton())
    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS / 2)
    await user.click(cloudButton())
    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS / 2)

    expect(cloudButton()).toHaveAccessibleName('Run on Comfy Cloud')
  })

  it('shows how far an upload has got, then goes back to Run on Comfy Cloud', async () => {
    renderButton()

    useModelUploadStore().start(PROTOTYPE_GAPS.modelsMissing.models)
    await vi.advanceTimersByTimeAsync(PROTOTYPE_UPLOAD_MS / 2)

    expect(cloudButton()).toHaveAccessibleName(/^Uploading 2 models · \d+%$/)

    await vi.advanceTimersByTimeAsync(PROTOTYPE_UPLOAD_MS)

    expect(cloudButton()).toHaveAccessibleName('Run on Comfy Cloud')
  })
})
