import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useFeatureFlags } from '@/composables/useFeatureFlags'
import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { modelFileUploadApi } from '@/platform/assets/services/modelFileUploadApi'
import { deploymentModelUploadApi } from '@/platform/workspace/api/deploymentModelUploadApi'
import type {
  DeploymentModelOutcome,
  DeploymentModelUploadResult
} from '@/platform/workspace/api/deploymentModelUploadApi'
import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { api } from '@/scripts/api'
import { useDialogStore } from '@/stores/dialogStore'

import UploadModelDialog from '@/platform/assets/components/UploadModelDialog.vue'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages },
  missingWarn: false,
  fallbackWarn: false
})

const copy = enMessages.assetBrowser.fileUpload
const lora = new File(['0123456789'], 'my_style_v2.safetensors')

function renderDialog(
  props: InstanceType<typeof UploadModelDialog>['$props'] = {}
) {
  return render(UploadModelDialog, {
    props,
    global: { plugins: [i18n], stubs: { VideoHelpDialog: true } }
  })
}

function pickDeployment() {
  Object.assign(useDeploymentPickStore(), {
    bootDeployment: {
      deployment_id: 'dep-1',
      release_id: 'release-1',
      status: 'ready',
      can_start: false,
      created_at: '2026-10-01T00:00:00Z'
    }
  })
  Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
}

function linkInput() {
  return screen.queryByPlaceholderText(
    enMessages.assetBrowser.genericLinkPlaceholder
  )
}

describe('UploadModelDialog destination', () => {
  beforeEach(() => {
    const flags = vi.mocked(useFeatureFlags().flags)
    flags.modelUploadFolders = ['checkpoints', 'loras']
    vi.mocked(api.getModelFolders).mockResolvedValue([
      { name: 'loras', folders: [] },
      { name: 'checkpoints', folders: [] }
    ])
  })

  it("is today's dialog with no deployment picked", () => {
    renderDialog()

    expect(screen.queryByText(copy.destination)).not.toBeInTheDocument()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
    expect(linkInput()).toBeInTheDocument()
    expect(screen.getByText(copy.choose)).toBeInTheDocument()
  })

  it('keeps the workspace library chosen with a deployment picked', () => {
    pickDeployment()
    renderDialog()

    expect(screen.getByRole('radio', { name: copy.toLibrary })).toBeChecked()
    expect(
      screen.getByRole('radio', { name: copy.toDeployment })
    ).not.toBeChecked()
    expect(linkInput()).toBeInTheDocument()
  })

  it('asks only for a file once this deployment is chosen', async () => {
    pickDeployment()
    const user = userEvent.setup()
    renderDialog()

    await user.click(screen.getByRole('radio', { name: copy.toDeployment }))

    expect(linkInput()).not.toBeInTheDocument()
    expect(screen.getByText(copy.choose)).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: enMessages.g.continue })
    ).not.toBeInTheDocument()
  })

  it('opens on this deployment when asked, and adds the file there', async () => {
    pickDeployment()
    const library = vi.spyOn(modelFileUploadApi, 'uploadModelFile')
    let finish!: (result: DeploymentModelUploadResult) => void
    const send = vi
      .spyOn(deploymentModelUploadApi, 'uploadModelToDeployment')
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            finish = resolve
          })
      )
    let settle!: (outcome: DeploymentModelOutcome) => void
    vi.spyOn(
      deploymentModelUploadApi,
      'waitForDeploymentModel'
    ).mockReturnValue(
      new Promise((resolve) => {
        settle = resolve
      })
    )
    const user = userEvent.setup()
    renderDialog({ initialDestination: 'deployment' })

    expect(screen.getByRole('radio', { name: copy.toDeployment })).toBeChecked()
    expect(linkInput()).not.toBeInTheDocument()

    await user.upload(screen.getByTestId('upload-model-file-input'), lora)
    expect(screen.getByRole('radio', { name: copy.toDeployment })).toBeChecked()
    await user.click(screen.getByRole('button', { name: copy.upload }))

    expect(await screen.findByText(copy.checking)).toBeInTheDocument()
    finish({ ok: true, modelId: 'model-1' })
    expect(await screen.findByText(copy.addingToDeployment)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: enMessages.g.close })
    ).toBeInTheDocument()

    settle('ready')
    expect(await screen.findByText(copy.ready)).toBeInTheDocument()
    expect(screen.getByText(copy.findInLoader)).toBeInTheDocument()
    expect(send).toHaveBeenCalledOnce()
    expect(library).not.toHaveBeenCalled()
  })

  it('offers no build link with no deployment picked', () => {
    renderDialog()

    expect(
      screen.queryByRole('button', { name: copy.addToBuild })
    ).not.toBeInTheDocument()
  })

  it("opens the deployment's build step from the build link", async () => {
    pickDeployment()
    const frames = usePlatformFrameStore()
    vi.spyOn(frames, 'isAvailable').mockReturnValue(true)
    const open = vi.spyOn(frames, 'open').mockReturnValue(true)
    const close = vi.spyOn(useDialogStore(), 'closeDialog')
    const user = userEvent.setup()
    renderDialog({ initialDestination: 'deployment' })

    await user.click(screen.getByRole('button', { name: copy.addToBuild }))

    expect(open).toHaveBeenCalledWith(
      { step: 'models', deploymentId: 'dep-1' },
      'model_library'
    )
    expect(close).toHaveBeenCalledWith({ key: 'upload-model' })
  })
})
