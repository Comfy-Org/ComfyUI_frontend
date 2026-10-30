import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import { useErrorHandling } from '@/composables/useErrorHandling'
import enMessages from '@/locales/en/main.json'
import type { PrototypeCloudCheck } from '@/platform/openOnCloud/cloudWorkflowCheck'
import { PROTOTYPE_CHECK_MS } from '@/platform/openOnCloud/cloudWorkflowCheck'
import { openWorkflowOnCloud } from '@/platform/openOnCloud/openWorkflowOnCloud'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { defaultGraph } from '@/scripts/defaultGraph'
import { useDialogStore } from '@/stores/dialogStore'

import CloudButton from './CloudButton.vue'

vi.mock(import('@/composables/auth/useAuthDialogs'))
vi.mock(import('@/composables/useErrorHandling'))
vi.mock(import('@/platform/openOnCloud/serializeRootGraph'), () => ({
  serializeRootGraph: vi.fn(() => defaultGraph)
}))
vi.mock(import('@/platform/openOnCloud/openWorkflowOnCloud'), () => ({
  openWorkflowOnCloud: vi.fn(async () => {})
}))
vi.mock(
  import('@/platform/workflow/deploy/composables/useAgentHandoff'),
  () => ({ useAgentHandoff: () => fromPartial({ copyBrief: vi.fn() }) })
)

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderButton() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  render(
    {
      components: { CloudButton, GlobalDialog },
      template: '<CloudButton /><GlobalDialog />'
    },
    { global: { plugins: [i18n] } }
  )
  return user
}

function cloudButton() {
  return screen.getByTestId('cloud-button')
}

function modalHeading() {
  return screen.queryByRole('heading', { level: 2 })
}

describe('CloudButton', () => {
  it('shows that it is checking while Comfy Cloud answers, without a modal', async () => {
    const user = renderButton()
    expect(cloudButton()).toHaveAccessibleName('Run on Comfy Cloud')

    await user.hover(cloudButton())

    expect(cloudButton()).toHaveAccessibleName('Checking Comfy Cloud…')
    expect(cloudButton()).toHaveAttribute('aria-busy', 'true')

    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)

    expect(cloudButton()).toHaveAccessibleName('Run on Comfy Cloud')
    expect(cloudButton()).not.toHaveAttribute('aria-busy')
    expect(modalHeading()).not.toBeInTheDocument()
  })

  it.for<{ check: PrototypeCloudCheck; heading: string; body: string }>([
    {
      check: 'canOpen',
      heading: 'Run on Comfy Cloud',
      body: 'Comfy Cloud has every node and model this workflow uses. It opens in a new tab, ready to run.'
    },
    {
      check: 'nodePacksMissing',
      heading: 'Deploy your setup to Comfy Cloud',
      body: 'This creates a deployment of your setup on Comfy Cloud. You manage it from Comfy Platform.'
    },
    {
      check: 'nodePacksAndModelsMissing',
      heading: 'Deploy your setup to Comfy Cloud',
      body: 'This creates a deployment of your setup on Comfy Cloud. You manage it from Comfy Platform.'
    },
    {
      check: 'signedOut',
      heading: 'Run on Comfy Cloud',
      body: 'Sign in to check whether Comfy Cloud can run this workflow.'
    }
  ])(
    'a click after the $check answer opens its modal at once',
    async ({ check, heading, body }) => {
      useCloudWorkflowCheckStore().prototypeCheck = check
      const user = renderButton()

      await user.hover(cloudButton())
      await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)
      await user.click(cloudButton())

      expect(
        await screen.findByRole('heading', { name: heading })
      ).toBeInTheDocument()
      expect(screen.getByText(body)).toBeInTheDocument()
    }
  )

  it('a click during the check opens the modal when the answer arrives', async () => {
    const user = renderButton()

    await user.hover(cloudButton())
    await user.click(cloudButton())
    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS / 2)

    expect(modalHeading()).not.toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS / 2)

    expect(
      await screen.findByRole('heading', { name: 'Run on Comfy Cloud' })
    ).toBeInTheDocument()
  })

  it('Enter checks Comfy Cloud, then opens the modal with the answer', async () => {
    const user = renderButton()

    await user.tab()
    await user.keyboard('{Enter}')

    expect(cloudButton()).toHaveAccessibleName('Checking Comfy Cloud…')

    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)

    expect(
      await screen.findByRole('heading', { name: 'Run on Comfy Cloud' })
    ).toBeInTheDocument()
  })

  it('keeps a running check when the pointer comes back', async () => {
    const user = renderButton()

    await user.hover(cloudButton())
    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS / 2)
    await user.unhover(cloudButton())
    await user.hover(cloudButton())
    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS / 2)

    expect(cloudButton()).toHaveAccessibleName('Run on Comfy Cloud')
  })

  it('closes the open modal while Comfy Cloud checks again, then shows the new answer', async () => {
    const user = renderButton()
    const store = useCloudWorkflowCheckStore()
    await user.hover(cloudButton())
    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)
    await user.click(cloudButton())
    await screen.findByRole('button', { name: 'Open on Comfy Cloud' })

    store.prototypeCheck = 'signedOut'
    void store.check()
    await vi.advanceTimersByTimeAsync(0)

    expect(cloudButton()).toHaveAccessibleName('Checking Comfy Cloud…')
    expect(modalHeading()).not.toBeInTheDocument()

    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)

    expect(
      await screen.findByRole('button', { name: 'Sign in' })
    ).toBeInTheDocument()
  })

  it('Cancel closes the modal, and the next check leaves it closed', async () => {
    const user = renderButton()
    await user.hover(cloudButton())
    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)
    await user.click(cloudButton())
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(modalHeading()).not.toBeInTheDocument()

    await user.hover(cloudButton())
    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)

    expect(modalHeading()).not.toBeInTheDocument()
  })

  it('a modal that fails to open leaves the next click free to open it', async () => {
    const user = renderButton()
    vi.spyOn(useDialogStore(), 'showDialog').mockImplementationOnce(() => {
      throw new Error('The dialog chunk failed to load')
    })
    await user.hover(cloudButton())
    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)
    await user.click(cloudButton())
    await vi.waitFor(() =>
      expect(useErrorHandling().toastErrorHandler).toHaveBeenCalledOnce()
    )

    await user.click(cloudButton())

    expect(
      await screen.findByRole('heading', { name: 'Run on Comfy Cloud' })
    ).toBeInTheDocument()
  })

  it('opens the modal an answer asked for while the button was away', async () => {
    useCloudWorkflowCheckStore().state = {
      phase: 'answered',
      verdict: { kind: 'canOpen' },
      showsModal: true
    }

    renderButton()

    expect(
      await screen.findByRole('heading', { name: 'Run on Comfy Cloud' })
    ).toBeInTheDocument()
  })

  it.for<{
    check: PrototypeCloudCheck
    action: string
    hands: () => unknown
  }>([
    {
      check: 'canOpen',
      action: 'Open on Comfy Cloud',
      hands: () => openWorkflowOnCloud
    },
    {
      check: 'signedOut',
      action: 'Sign in',
      hands: () => useAuthDialogs().showSignInDialog
    }
  ])(
    '$action hands off and closes the modal',
    async ({ check, action, hands }) => {
      useCloudWorkflowCheckStore().prototypeCheck = check
      const user = renderButton()
      await user.hover(cloudButton())
      await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)
      await user.click(cloudButton())

      await user.click(await screen.findByRole('button', { name: action }))

      expect(hands()).toHaveBeenCalledOnce()
      expect(modalHeading()).not.toBeInTheDocument()
    }
  )
})
