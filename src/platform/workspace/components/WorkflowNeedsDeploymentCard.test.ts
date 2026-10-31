import { getActivePinia } from 'pinia'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'

import type { useExternalLink } from '@/composables/useExternalLink'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import type { MissingModelCandidate } from '@/platform/workflowErrors/missingModel/types'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import type { MissingNodeType } from '@/platform/workflowErrors/nodeReplacement/types'
import { testI18n } from '@/utils/__tests__/testI18n'

import WorkflowNeedsDeploymentCard from './WorkflowNeedsDeploymentCard.vue'

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

vi.mock(import('@/composables/useExternalLink'), () => ({
  useExternalLink: () =>
    fromPartial<ReturnType<typeof useExternalLink>>({
      buildDocsUrl: (path: string) => `https://docs.comfy.org${path}`
    })
}))

function checkpoint(name: string): MissingModelCandidate {
  return {
    nodeType: 'CheckpointLoaderSimple',
    widgetName: 'ckpt_name',
    name,
    directory: 'checkpoints',
    isMissing: true,
    isAssetSupported: false
  }
}

function renderCard(
  nodeTypes: MissingNodeType[],
  models: MissingModelCandidate[]
) {
  const pinia = getActivePinia()!
  useMissingNodesErrorStore(pinia).surfaceMissingNodes(nodeTypes)
  useMissingModelStore(pinia).setMissingModels(models)
  const user = userEvent.setup()
  render(WorkflowNeedsDeploymentCard, {
    global: { plugins: [pinia, testI18n] }
  })
  return user
}

describe('WorkflowNeedsDeploymentCard', () => {
  it('names what the workflow lacks under the custom deployment pitch, without a video', () => {
    renderCard(
      [
        { type: 'BiRefNet', cnrId: 'comfyui-birefnet', isReplaceable: false },
        { type: 'RMBG', cnrId: 'comfyui-rmbg', isReplaceable: false },
        { type: 'Impact', cnrId: 'comfyui-impact-pack', isReplaceable: false },
        { type: 'KJ', cnrId: 'comfyui-kjnodes', isReplaceable: false },
        { type: 'QwenImage21Cache', isReplaceable: false },
        { type: 'OldSampler', cnrId: 'comfyui-old', isReplaceable: true }
      ],
      [checkpoint('sd_xl_base_1.0.safetensors')]
    )

    expect(
      screen.getByRole('heading', {
        name: 'Run this workflow on a custom deployment'
      })
    ).toBeInTheDocument()
    expect(screen.getByTestId('custom-deployment-missing')).toHaveTextContent(
      [
        '4 missing node packs',
        'comfyui-birefnet, comfyui-rmbg, comfyui-impact-pack, and 1 more',
        '1 missing node',
        'QwenImage21Cache',
        '1 missing model',
        'sd_xl_base_1.0.safetensors'
      ].join('')
    )
    expect(
      screen.queryByTestId('custom-deployment-missing')
    ).not.toHaveTextContent('comfyui-old')
    expect(
      screen.getByRole('link', { name: /Create on Platform/ })
    ).toBeInTheDocument()
    expect(
      screen.queryByTestId('custom-deployment-video')
    ).not.toBeInTheDocument()
  })

  it('shows names as written in a row that lists more than three', () => {
    renderCard(
      [{ type: 'BiRefNet', cnrId: 'comfyui-birefnet', isReplaceable: false }],
      [
        checkpoint('SDXL/base.safetensors'),
        checkpoint("SDXL/Tom's=refiner.safetensors"),
        checkpoint('SDXL/a&b.safetensors'),
        checkpoint('SDXL/turbo.safetensors')
      ]
    )

    expect(screen.getByTestId('custom-deployment-missing')).toHaveTextContent(
      "SDXL/base.safetensors, SDXL/Tom's=refiner.safetensors, SDXL/a&b.safetensors, and 1 more"
    )
  })

  it('copies a brief that lists every missing pack, node and model', async () => {
    const user = renderCard(
      [
        { type: 'KJ', cnrId: 'comfyui-kjnodes', isReplaceable: false },
        { type: 'QwenImage21Cache', isReplaceable: false },
        { type: 'OldSampler', cnrId: 'comfyui-old', isReplaceable: true }
      ],
      [checkpoint('sd_xl_base_1.0.safetensors')]
    )

    await user.click(screen.getByTestId('custom-deployment-agent'))

    const brief = await navigator.clipboard.readText()
    expect(brief).toContain('- Pack `comfyui-kjnodes`: `KJ`')
    expect(brief).toContain('- Pack unknown: `QwenImage21Cache`')
    expect(brief).toContain(
      '- `sd_xl_base_1.0.safetensors` in `models/checkpoints`'
    )
    expect(brief).not.toContain('OldSampler')
  })
})
