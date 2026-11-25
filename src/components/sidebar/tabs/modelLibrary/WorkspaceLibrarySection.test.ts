import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'
import type { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import { startModelLoaderDrag } from '@/composables/node/startModelLoaderDrag'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import enMessages from '@/locales/en/main.json'
import { assetService } from '@/platform/assets/services/assetService'
import { useDeploymentLibraryModelsStore } from '@/platform/workspace/stores/deploymentLibraryModelsStore'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { ModelFolder } from '@/stores/modelStore'
import { useModelStore } from '@/stores/modelStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

import WorkspaceLibrarySection from './WorkspaceLibrarySection.vue'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/composables/node/startModelLoaderDrag'))
vi.mock(import('@comfyorg/telemetry/reportError'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const library = new Map<string, string[]>()

function folder(directory: string) {
  return fromPartial<ModelFolder>({ directory })
}

function renderSection(searchQuery = '') {
  const user = userEvent.setup()
  const view = render(
    {
      components: { TooltipProvider, WorkspaceLibrarySection },
      setup: () => ({ searchQuery }),
      template:
        '<TooltipProvider><WorkspaceLibrarySection :search-query="searchQuery" /></TooltipProvider>'
    },
    { global: { plugins: [i18n] } }
  )
  return { user, ...view }
}

beforeEach(() => {
  library.clear()
  vi.spyOn(assetService, 'getWorkspaceLibraryModels').mockImplementation(
    async (name) => library.get(name) ?? []
  )
  vi.mocked(useFeatureFlags().flags).runtimeLibraryModelsEnabled = true
  Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
  useDeploymentPickStore().bootDeployment = {
    deployment_id: 'dep-1',
    release_id: 'release-1',
    status: 'ready',
    can_start: false,
    created_at: '2026-10-01T00:00:00Z'
  }
  Object.assign(useModelStore(), {
    modelFolders: [folder('loras'), folder('configs')]
  })
})

describe('WorkspaceLibrarySection', () => {
  it('starts closed and reads nothing', () => {
    renderSection()

    expect(
      screen.getByRole('button', { name: 'Workspace library' })
    ).toHaveAttribute('aria-expanded', 'false')
    expect(assetService.getWorkspaceLibraryModels).not.toHaveBeenCalled()
  })

  it('explains that models outside the build download when a job needs them', () => {
    renderSection()

    expect(
      screen.getByRole('button', {
        name: 'Models in your workspace. Ones not in this build download when a job needs them.'
      })
    ).toBeInTheDocument()
  })

  it('lists the library by folder once opened', async () => {
    library.set('loras', ['detail-tweaker.safetensors'])
    const { user } = renderSection()

    await user.click(screen.getByRole('button', { name: 'Workspace library' }))

    expect(
      await screen.findByRole('button', { name: 'detail-tweaker.safetensors' })
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'loras' })).toBeInTheDocument()
    expect(assetService.getWorkspaceLibraryModels).toHaveBeenCalledWith('loras')
    expect(assetService.getWorkspaceLibraryModels).not.toHaveBeenCalledWith(
      'configs'
    )
  })

  it('marks each model as from the workspace, not as a download a build may not need, and counts them in the header', async () => {
    library.set('loras', [
      'detail-tweaker.safetensors',
      'portrait-detail.safetensors'
    ])
    Object.assign(useModelStore(), {
      modelFolders: [folder('loras'), folder('checkpoints')]
    })
    library.set('checkpoints', ['sd_xl_base_1.0.safetensors'])
    const { user } = renderSection()
    expect(screen.queryByTestId('workspace-library-count')).toBeNull()

    await user.click(screen.getByRole('button', { name: 'Workspace library' }))

    await waitFor(() =>
      expect(
        screen.getAllByRole('img', { name: 'From your workspace' })
      ).toHaveLength(3)
    )
    expect(screen.queryByText(/download/i)).toBeNull()
    expect(screen.queryByRole('img', { name: /download/i })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Workspace library 3 models' })
    ).toBeInTheDocument()
  })

  it('shows no count while a folder it counts has not loaded yet', async () => {
    library.set('loras', ['detail-tweaker.safetensors'])
    library.set('checkpoints', [
      'sd_xl_base_1.0.safetensors',
      'sd_xl_refiner_1.0.safetensors'
    ])
    Object.assign(useModelStore(), {
      modelFolders: [folder('loras'), folder('checkpoints')]
    })
    const libraryModels = useDeploymentLibraryModelsStore()
    libraryModels.refresh('loras')
    await libraryModels.waitForSettled('loras')

    renderSection()

    expect(screen.queryByTestId('workspace-library-count')).toBeNull()
  })

  it('says so when the library is empty', async () => {
    const { user } = renderSection()

    await user.click(screen.getByRole('button', { name: 'Workspace library' }))

    expect(
      await screen.findByText('No models in your workspace library.')
    ).toBeInTheDocument()
  })

  it('says nothing matches when the search hides every model', async () => {
    library.set('loras', ['detail-tweaker.safetensors'])
    const { user } = renderSection('zzz')

    await user.click(screen.getByRole('button', { name: 'Workspace library' }))

    expect(await screen.findByText('No Results')).toBeInTheDocument()
    expect(
      screen.queryByText('No models in your workspace library.')
    ).not.toBeInTheDocument()
  })

  it('says the library failed to load instead of calling it empty', async () => {
    vi.mocked(assetService.getWorkspaceLibraryModels).mockRejectedValue(
      new Error('inventory unavailable')
    )
    const { user } = renderSection()

    await user.click(screen.getByRole('button', { name: 'Workspace library' }))

    expect(
      await screen.findByText("Couldn't load your workspace library.")
    ).toBeInTheDocument()
    expect(
      screen.queryByText('No models in your workspace library.')
    ).not.toBeInTheDocument()
  })

  it('reads the library again on retry', async () => {
    vi.mocked(assetService.getWorkspaceLibraryModels).mockRejectedValueOnce(
      new Error('inventory unavailable')
    )
    library.set('loras', ['detail-tweaker.safetensors'])
    const { user } = renderSection()

    await user.click(screen.getByRole('button', { name: 'Workspace library' }))
    await user.click(await screen.findByRole('button', { name: 'Retry' }))

    expect(
      await screen.findByRole('button', { name: 'detail-tweaker.safetensors' })
    ).toBeInTheDocument()
    expect(
      screen.queryByText("Couldn't load your workspace library.")
    ).not.toBeInTheDocument()
    expect(assetService.getWorkspaceLibraryModels).toHaveBeenCalledTimes(2)
  })

  it('places a loader for the model that was clicked', async () => {
    library.set('loras', ['detail-tweaker.safetensors'])
    const provider = {
      nodeDef: fromPartial<ComfyNodeDefImpl>({ name: 'LoraLoader' }),
      key: 'lora_name'
    }
    vi.mocked(useModelToNodeStore().getNodeProvider).mockReturnValue(provider)
    const { user } = renderSection()

    await user.click(screen.getByRole('button', { name: 'Workspace library' }))
    await user.click(
      await screen.findByRole('button', { name: 'detail-tweaker.safetensors' })
    )

    expect(useModelToNodeStore().getNodeProvider).toHaveBeenCalledWith('loras')
    expect(startModelLoaderDrag).toHaveBeenCalledWith(
      provider,
      'detail-tweaker.safetensors'
    )
  })
})
