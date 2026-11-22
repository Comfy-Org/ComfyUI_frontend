import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import TooltipProvider from '@comfyorg/design-system/tooltip/TooltipProvider'
import type { ComfyNodeDefImpl } from '@/core/graph/nodeDef/ComfyNodeDefImpl'
import { startModelLoaderDrag } from '@/composables/node/startModelNodeDragFromAsset'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import enMessages from '@/locales/en/main.json'
import { assetService } from '@/platform/assets/services/assetService'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import type { ModelFolder } from '@/stores/modelStore'
import { useModelStore } from '@/stores/modelStore'
import { useModelToNodeStore } from '@/stores/modelToNodeStore'

import WorkspaceLibrarySection from './WorkspaceLibrarySection.vue'

vi.mock(import('@/scripts/api'))
vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/composables/node/startModelNodeDragFromAsset'))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

const library = new Map<string, string[]>()

function folder(directory: string) {
  return fromPartial<ModelFolder>({ directory })
}

function renderSection() {
  const user = userEvent.setup()
  const view = render(
    {
      components: { TooltipProvider, WorkspaceLibrarySection },
      template: '<TooltipProvider><WorkspaceLibrarySection /></TooltipProvider>'
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

  it('explains that these models are not in the build', () => {
    renderSection()

    expect(
      screen.getByRole('button', {
        name: 'These models are not in this build. They download when a job runs.'
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

  it('says so when the library is empty', async () => {
    const { user } = renderSection()

    await user.click(screen.getByRole('button', { name: 'Workspace library' }))

    expect(
      await screen.findByText('No models in your workspace library.')
    ).toBeInTheDocument()
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
