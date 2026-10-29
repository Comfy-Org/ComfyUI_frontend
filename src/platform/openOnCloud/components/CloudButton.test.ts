import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import {
  PROTOTYPE_CHECK_MS,
  PROTOTYPE_GAPS
} from '@/platform/openOnCloud/cloudWorkflowCheck'
import { openRunOnCloudDialog } from '@/platform/openOnCloud/openRunOnCloudDialog'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import {
  PROTOTYPE_UPLOAD_MS,
  useModelUploadStore
} from '@/platform/openOnCloud/stores/modelUploadStore'
import { defaultGraph } from '@/scripts/defaultGraph'

import CloudButton from './CloudButton.vue'

vi.mock(import('@/composables/useErrorHandling'))
vi.mock(import('@/platform/openOnCloud/openRunOnCloudDialog'), () => ({
  openRunOnCloudDialog: vi.fn(async () => {})
}))
vi.mock(import('@/platform/openOnCloud/serializeRootGraph'), () => ({
  serializeRootGraph: vi.fn(() => defaultGraph)
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const READY = { phase: 'answered', verdict: { kind: 'canOpen' } }

function renderButton() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(CloudButton, { global: { plugins: [i18n] } })
  return user
}

function cloudButton() {
  return screen.getByTestId('cloud-button')
}

describe('CloudButton', () => {
  it('checks Comfy Cloud when the pointer reaches it, so a click opens the answer', async () => {
    const user = renderButton()

    await user.hover(cloudButton())
    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)
    await user.click(cloudButton())

    expect(useCloudWorkflowCheckStore().state).toEqual(READY)
    expect(openRunOnCloudDialog).toHaveBeenCalledOnce()
  })

  it('checks Comfy Cloud when a key presses it', async () => {
    const user = renderButton()

    await user.tab()
    await user.keyboard('{Enter}')

    expect(useCloudWorkflowCheckStore().state.phase).toBe('checking')
    expect(openRunOnCloudDialog).toHaveBeenCalledOnce()
  })

  it('keeps a running check when the button is clicked', async () => {
    const user = renderButton()

    await user.hover(cloudButton())
    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS / 2)
    await user.click(cloudButton())
    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS / 2)

    expect(useCloudWorkflowCheckStore().state).toEqual(READY)
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
