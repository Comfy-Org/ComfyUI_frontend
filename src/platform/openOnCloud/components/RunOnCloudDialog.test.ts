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
import { useLocalSignInStore } from '@/platform/openOnCloud/stores/localSignInStore'
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
const DEPLOY_BODY =
  'This creates a deployment of your setup on Comfy Cloud. You manage it from Comfy Platform.'
const SIGN_IN_NOTE = 'Comfy Cloud will ask you to sign in.'

function renderDialog() {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const { emitted } = render(RunOnCloudDialog, {
    global: { plugins: [i18n] }
  })
  return { user, emitted }
}

function startCheck(scenario: PrototypeScenario, signedIn = true) {
  useLocalSignInStore().signedIn = signedIn
  const checkStore = useCloudWorkflowCheckStore()
  checkStore.prototypeScenario = scenario
  void checkStore.check(defaultGraph)
}

async function renderAnswered(scenario: PrototypeScenario, signedIn = true) {
  startCheck(scenario, signedIn)
  await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)
  return renderDialog()
}

describe('RunOnCloudDialog', () => {
  it.for<{
    scenario: PrototypeScenario
    signedIn: boolean
    heading: string
    body: string
    primary: string
    asksToSignIn: boolean
  }>([
    {
      scenario: 'compatible',
      signedIn: true,
      heading: 'Run on Comfy Cloud',
      body: READY_BODY,
      primary: 'Open on Comfy Cloud',
      asksToSignIn: false
    },
    {
      scenario: 'compatible',
      signedIn: false,
      heading: 'Run on Comfy Cloud',
      body: READY_BODY,
      primary: 'Open on Comfy Cloud',
      asksToSignIn: true
    },
    {
      scenario: 'nodePacksMissing',
      signedIn: true,
      heading: 'Deploy your setup to Comfy Cloud',
      body: DEPLOY_BODY,
      primary: 'Build with your agent',
      asksToSignIn: false
    },
    {
      scenario: 'nodePacksMissing',
      signedIn: false,
      heading: 'Deploy your setup to Comfy Cloud',
      body: DEPLOY_BODY,
      primary: 'Build with your agent',
      asksToSignIn: false
    },
    {
      scenario: 'nodePacksAndModelsMissing',
      signedIn: false,
      heading: 'Deploy your setup to Comfy Cloud',
      body: DEPLOY_BODY,
      primary: 'Build with your agent',
      asksToSignIn: false
    },
    {
      scenario: 'modelsMissing',
      signedIn: true,
      heading: 'Upload 2 models',
      body: 'Upload these models to run this workflow on Comfy Cloud.',
      primary: 'Upload',
      asksToSignIn: false
    },
    {
      scenario: 'modelsMissing',
      signedIn: false,
      heading: 'Upload 2 models',
      body: 'Upload these models to run this workflow on Comfy Cloud.',
      primary: 'Sign in to upload',
      asksToSignIn: false
    }
  ])(
    'opens $scenario with $primary, signed in: $signedIn',
    async ({ scenario, signedIn, heading, body, primary, asksToSignIn }) => {
      await renderAnswered(scenario, signedIn)

      expect(screen.getByRole('heading')).toHaveTextContent(heading)
      expect(screen.getByText(body)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: primary })).toBeEnabled()
      expect(screen.queryAllByText(SIGN_IN_NOTE)).toHaveLength(
        asksToSignIn ? 1 : 0
      )
    }
  )

  it('shows no modal while Comfy Cloud is checking', () => {
    startCheck('compatible')
    renderDialog()

    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('switches at once when the panel picks another scenario', async () => {
    await renderAnswered('compatible')

    useCloudWorkflowCheckStore().prototypeScenario = 'modelsMissing'
    await vi.advanceTimersByTimeAsync(0)

    expect(screen.getByRole('button', { name: 'Upload' })).toBeInTheDocument()
  })

  it.for([true, false])(
    'Open on Comfy Cloud opens the workflow there and closes the modal, signed in: %s',
    async (signedIn) => {
      const { user, emitted } = await renderAnswered('compatible', signedIn)

      await user.click(
        screen.getByRole('button', { name: 'Open on Comfy Cloud' })
      )

      expect(openWorkflowOnCloud).toHaveBeenCalledOnce()
      expect(useAuthDialogs().showSignInDialog).not.toHaveBeenCalled()
      expect(emitted()).toHaveProperty('done')
    }
  )

  it('Sign in to upload shows the sign-in dialog and keeps the modal', async () => {
    const { user, emitted } = await renderAnswered('modelsMissing', false)

    await user.click(screen.getByRole('button', { name: 'Sign in to upload' }))

    expect(useAuthDialogs().showSignInDialog).toHaveBeenCalledOnce()
    expect(useModelUploadStore().state).toEqual({ phase: 'idle' })
    expect(emitted()).not.toHaveProperty('done')
  })

  it.for<{
    library: 'lacksModels' | 'hasModels'
    heading: string
    primary: string
  }>([
    { library: 'lacksModels', heading: 'Upload 2 models', primary: 'Upload' },
    {
      library: 'hasModels',
      heading: 'Run on Comfy Cloud',
      primary: 'Open on Comfy Cloud'
    }
  ])(
    'after sign-in, the check runs again and the library $library: $primary',
    async ({ library, heading, primary }) => {
      vi.mocked(useAuthDialogs().showSignInDialog).mockResolvedValueOnce(true)
      useCloudWorkflowCheckStore().prototypeLibrary = library
      const { user } = await renderAnswered('modelsMissing', false)

      await user.click(
        screen.getByRole('button', { name: 'Sign in to upload' })
      )

      expect(screen.queryByRole('heading')).not.toBeInTheDocument()

      await vi.advanceTimersByTimeAsync(PROTOTYPE_CHECK_MS)

      expect(screen.getByRole('heading')).toHaveTextContent(heading)
      expect(screen.getByRole('button', { name: primary })).toBeEnabled()
      expect(screen.queryByText(SIGN_IN_NOTE)).not.toBeInTheDocument()
    }
  )

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
