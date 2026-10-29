import type { ReleaseUnsupportedPack } from '@comfyorg/ingest-types'
import { render, screen } from '@testing-library/vue'
import type { UserEvent } from '@testing-library/user-event'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import type { MissingPackGroup } from '@/platform/workflowErrors/panel/useErrorGroups'
import { groupMissingModelCandidates } from '@/platform/workflowErrors/missingModel/missingModelGrouping'
import type { MissingModelGroup } from '@/platform/workflowErrors/missingModel/types'
import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { testI18n } from '@/utils/__tests__/testI18n'

import DeploymentBuildActions from './DeploymentBuildActions.vue'

const copyToClipboard = vi.hoisted(() => vi.fn())
vi.mock(import('@/composables/useCopyToClipboard'), () => ({
  useCopyToClipboard: () => ({ copyToClipboard })
}))

const deployment: WorkspaceDeployment = {
  deployment_id: 'dep-1',
  deployment_name: 'production',
  build_id: 'build-7',
  build_name: 'video-minimax-h3 copy',
  release_id: 'rel-3',
  status: 'ready',
  created_at: '2026-10-01T00:00:00Z'
}

const missingPackGroups: MissingPackGroup[] = [
  {
    packId: null,
    nodeTypes: ['QwenImage21Cache', { type: 'TextEncodeQwenImage21' }],
    isResolving: false
  }
]

const missingModelGroups: MissingModelGroup[] = [
  {
    directory: 'vae',
    isAssetSupported: true,
    models: [
      {
        name: 'qwen_image_2.1_vae.safetensors',
        representative: {
          name: 'qwen_image_2.1_vae.safetensors',
          nodeType: 'VAELoader',
          widgetName: 'vae_name',
          isAssetSupported: true,
          isMissing: true,
          url: 'https://huggingface.co/comfy/qwen/resolve/main/vae.safetensors'
        },
        referencingNodes: []
      }
    ]
  }
]

function renderActions(
  props: Partial<ComponentProps<typeof DeploymentBuildActions>> = {}
) {
  render(DeploymentBuildActions, {
    props: { deployment, missingPackGroups, missingModelGroups, ...props },
    global: { plugins: [testI18n] }
  })
  return userEvent.setup()
}

async function copiedBrief(user: UserEvent): Promise<string> {
  copyToClipboard.mockResolvedValue(true)
  await user.click(
    screen.getByRole('button', { name: /Build with your agent/ })
  )
  const [brief] = copyToClipboard.mock.lastCall ?? []
  return String(brief)
}

const nvidiaVfx: ReleaseUnsupportedPack = {
  folder: 'ComfyUI-NVIDIA-VFX',
  registry_id: 'comfyui-nvidia-vfx',
  repository: 'https://github.com/NVIDIA/ComfyUI-NVIDIA-VFX',
  cause: 'needs a GPU'
}

describe('DeploymentBuildActions', () => {
  it.for([
    {
      build: 'is known',
      buildId: 'build-7',
      label: 'Edit build on Platform',
      path: '/profile/builds/build-7'
    },
    {
      build: 'is not in the listing',
      buildId: undefined,
      label: 'Open Builds on Platform',
      path: '/profile/builds'
    }
  ])(
    'links to "$label" on Platform when the Build id $build',
    ({ buildId, label, path }) => {
      renderActions({ deployment: { ...deployment, build_id: buildId } })

      const link = screen.getByRole('link', { name: label })
      expect(new URL(link.getAttribute('href') ?? '').pathname).toBe(path)
      expect(link).toHaveAttribute('target', '_blank')
    }
  )

  it('copies a brief listing the missing node types and models, then says so', async () => {
    copyToClipboard.mockResolvedValue(true)
    const user = renderActions()

    await user.click(
      screen.getByRole('button', { name: /Build with your agent/ })
    )

    const [brief] = copyToClipboard.mock.lastCall ?? []
    expect(brief).toContain(
      '- Pack unknown: `QwenImage21Cache`, `TextEncodeQwenImage21`'
    )
    expect(brief).toContain(
      '- `qwen_image_2.1_vae.safetensors` in `models/vae`, from https://huggingface.co/comfy/qwen/resolve/main/vae.safetensors'
    )
    expect(
      await screen.findByRole('button', { name: /Copied/ })
    ).toBeInTheDocument()
  })

  it('gives a custom-node model its folder though Comfy Cloud groups it without one', async () => {
    const user = renderActions({
      missingPackGroups: [],
      missingModelGroups: groupMissingModelCandidates(
        [
          {
            nodeId: '5',
            nodeType: 'NVVFXLoader',
            widgetName: 'lora_name',
            name: 'custom-node-model.safetensors',
            directory: 'loras',
            isAssetSupported: false,
            isMissing: true
          }
        ],
        true
      )
    })

    expect((await copiedBrief(user)).split('\n')).toContain(
      '- `custom-node-model.safetensors` in `models/loras`'
    )
  })

  it('briefs a pack the Build has but cannot load with why it fails', async () => {
    vi.spyOn(useDeploymentPickStore(), 'unsupportedPackFor').mockImplementation(
      (cnrId) => (cnrId === nvidiaVfx.registry_id ? nvidiaVfx : undefined)
    )
    const user = renderActions({
      missingPackGroups: [
        {
          packId: 'comfyui-nvidia-vfx',
          nodeTypes: [
            { type: 'NVVFXSuperRes', nodeId: '7', cnrId: 'comfyui-nvidia-vfx' }
          ],
          isResolving: false
        }
      ]
    })

    expect((await copiedBrief(user)).split('\n')).toContain(
      '- Pack `comfyui-nvidia-vfx`: `NVVFXSuperRes` (fails with: needs a GPU)'
    )
  })
})
