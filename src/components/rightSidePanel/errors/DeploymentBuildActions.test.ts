import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import type { MissingPackGroup } from '@/components/rightSidePanel/errors/useErrorGroups'
import type { MissingModelGroup } from '@/platform/missingModel/types'
import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
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

function renderActions(build: Partial<WorkspaceDeployment> = {}) {
  render(DeploymentBuildActions, {
    props: {
      deployment: { ...deployment, ...build },
      missingPackGroups,
      missingModelGroups
    },
    global: { plugins: [testI18n] }
  })
  return userEvent.setup()
}

describe('DeploymentBuildActions', () => {
  it.for([
    { build: 'is known', buildId: 'build-7', path: '/profile/builds/build-7' },
    {
      build: 'is not in the listing',
      buildId: undefined,
      path: '/profile/builds'
    }
  ])(
    'links to the Build on Platform when its id $build',
    ({ buildId, path }) => {
      renderActions({ build_id: buildId })

      const link = screen.getByRole('link', { name: /Edit build on Platform/ })
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
})
