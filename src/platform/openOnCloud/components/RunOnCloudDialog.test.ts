import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json'
import { useAuthDialogs } from '@/composables/auth/useAuthDialogs'
import type { PrototypeScenario } from '@/platform/openOnCloud/cloudWorkflowCheck'
import { PROTOTYPE_CHECK_MS } from '@/platform/openOnCloud/cloudWorkflowCheck'
import { openWorkflowOnCloud } from '@/platform/openOnCloud/openWorkflowOnCloud'
import { useCloudWorkflowCheckStore } from '@/platform/openOnCloud/stores/cloudWorkflowCheckStore'
import { useLocalAgentStore } from '@/platform/openOnCloud/stores/localAgentStore'
import {
  PROTOTYPE_UPLOAD_MS,
  useModelUploadStore
} from '@/platform/openOnCloud/stores/modelUploadStore'
import { defaultGraph } from '@/scripts/defaultGraph'

import RunOnCloudDialog from './RunOnCloudDialog.vue'

vi.mock(import('@/platform/openOnCloud/openWorkflowOnCloud'), () => ({
  openWorkflowOnCloud: vi.fn(async () => {})
}))
vi.mock(import('@/composables/auth/useAuthDialogs'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const READY_BODY =
  'Comfy Cloud has every node and model this workflow uses. It opens in a new tab, ready to run.'

function renderDialog() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { emitted } = render(RunOnCloudDialog, {
    global: { plugins: [i18n] }
  })
  return { user, emitted }
}

function startCheck(scenario: PrototypeScenario) {
  const checkStore = useCloudWorkflowCheckStore()
  checkStore.prototypeScenario = scenario
  void checkStore.check(defaultGraph)
}

async function renderAnswered(scenario: PrototypeScenario) {
  startCheck(scenario)
  await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)
  return renderDialog()
}

describe('RunOnCloudDialog', () => {
  it.for<{
    scenario: PrototypeScenario
    heading: string
    body: string
    primary: string
    enabled: boolean
  }>([
    {
      scenario: 'compatible',
      heading: 'Run on Comfy Cloud',
      body: READY_BODY,
      primary: 'Open on Comfy Cloud',
      enabled: true
    },
    {
      scenario: 'nodePacksMissing',
      heading: 'Run on Comfy Cloud',
      body: "Comfy Cloud is missing 2 node packs: rgthree-comfy and comfyui-impact-pack. We'll start your local agent to get this workflow running on Comfy Cloud. You'll approve any local file uploads along the way.",
      primary: 'Start agent',
      enabled: true
    },
    {
      scenario: 'nodePacksAndModelsMissing',
      heading: 'Run on Comfy Cloud',
      body: "Comfy Cloud is missing 2 node packs: rgthree-comfy and comfyui-impact-pack, and 1 model: face_yolov8m.pt. We'll start your local agent to get this workflow running on Comfy Cloud. You'll approve any local file uploads along the way.",
      primary: 'Start agent',
      enabled: true
    },
    {
      scenario: 'modelsMissing',
      heading: 'Upload 2 models',
      body: 'Upload these models to run this workflow on Comfy Cloud.',
      primary: 'Upload',
      enabled: true
    },
    {
      scenario: 'checking',
      heading: 'Run on Comfy Cloud',
      body: 'Checking whether Comfy Cloud has every node and model this workflow uses…',
      primary: 'Open on Comfy Cloud',
      enabled: false
    },
    {
      scenario: 'signedOut',
      heading: 'Run on Comfy Cloud',
      body: 'Sign in to check whether Comfy Cloud can run this workflow.',
      primary: 'Sign in',
      enabled: true
    }
  ])(
    'opens the modal for $scenario',
    async ({ scenario, heading, body, primary, enabled }) => {
      await renderAnswered(scenario)

      expect(screen.getByRole('heading')).toHaveTextContent(heading)
      expect(screen.getByText(body)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: primary })).toHaveProperty(
        'disabled',
        !enabled
      )
    }
  )

  it('switches the open modal to the answer when it arrives', async () => {
    startCheck('compatible')
    renderDialog()
    const open = screen.getByRole('button', { name: 'Open on Comfy Cloud' })
    expect(open).toBeDisabled()

    await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)

    expect(screen.getByText(READY_BODY)).toBeInTheDocument()
    expect(open).toBeEnabled()
  })

  it('switches at once when the panel picks another scenario', async () => {
    await renderAnswered('compatible')

    useCloudWorkflowCheckStore().prototypeScenario = 'signedOut'
    await vi.advanceTimersByTimeAsync(0)

    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument()
  })

  it.for<{ scenario: PrototypeScenario; primary: string; ran: () => void }>([
    {
      scenario: 'compatible',
      primary: 'Open on Comfy Cloud',
      ran: () => expect(openWorkflowOnCloud).toHaveBeenCalledOnce()
    },
    {
      scenario: 'nodePacksMissing',
      primary: 'Start agent',
      ran: () => expect(useLocalAgentStore().isConverting).toBe(true)
    },
    {
      scenario: 'signedOut',
      primary: 'Sign in',
      ran: () =>
        expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
    }
  ])(
    '$primary runs and closes the modal',
    async ({ scenario, primary, ran }) => {
      const { user, emitted } = await renderAnswered(scenario)

      await user.click(screen.getByRole('button', { name: primary }))

      ran()
      expect(emitted()).toHaveProperty('done')
    }
  )

  it('without a local agent, offers Platform and copies a prompt that names the packs', async () => {
    useLocalAgentStore().prototypeAgent = 'notFound'
    const { user } = await renderAnswered('nodePacksMissing')

    expect(
      screen.getByRole('link', { name: 'Open in Platform' })
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Copy prompt' }))

    const prompt = await navigator.clipboard.readText()
    expect(prompt).toContain('rgthree-comfy')
    expect(prompt).toContain('comfyui-impact-pack')
  })

  it('uploads the models, then shows the ready modal', async () => {
    const { user } = await renderAnswered('modelsMissing')

    await user.click(screen.getByRole('button', { name: 'Upload' }))

    expect(screen.getByRole('heading')).toHaveTextContent('Uploading 2 models')

    await vi.advanceTimersByTimeAsync(PROTOTYPE_UPLOAD_MS)

    expect(screen.getByRole('heading')).toHaveTextContent('Run on Comfy Cloud')
    expect(screen.getByText(READY_BODY)).toBeInTheDocument()
  })

  it('Cancel upload stops the upload and closes the modal', async () => {
    const { user, emitted } = await renderAnswered('modelsMissing')
    await user.click(screen.getByRole('button', { name: 'Upload' }))

    await user.click(screen.getByRole('button', { name: 'Cancel upload' }))

    expect(useModelUploadStore().state).toEqual({ phase: 'idle' })
    expect(emitted()).toHaveProperty('dismiss')
  })
})
