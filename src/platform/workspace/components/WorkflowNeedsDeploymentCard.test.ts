import { getActivePinia } from 'pinia'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { useExternalLink } from '@/composables/useExternalLink'
import enMessages from '@/locales/en/main.json'
import { useMissingModelStore } from '@/platform/workflowErrors/missingModel/missingModelStore'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'

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

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderCard() {
  const pinia = getActivePinia()!
  useMissingNodesErrorStore(pinia).surfaceMissingNodes([
    { type: 'BiRefNet', cnrId: 'comfyui-birefnet', isReplaceable: false },
    { type: 'RMBG', cnrId: 'comfyui-rmbg', isReplaceable: false },
    { type: 'Impact', cnrId: 'comfyui-impact-pack', isReplaceable: false },
    { type: 'KJ', cnrId: 'comfyui-kjnodes', isReplaceable: false },
    { type: 'QwenImage21Cache', isReplaceable: false },
    { type: 'OldSampler', cnrId: 'comfyui-old', isReplaceable: true }
  ])
  useMissingModelStore(pinia).setMissingModels([
    {
      nodeType: 'BiRefNetLoader',
      widgetName: 'model',
      name: 'BiRefNet-general.safetensors',
      directory: 'BiRefNet',
      isMissing: true,
      isAssetSupported: false
    }
  ])
  const user = userEvent.setup()
  render(WorkflowNeedsDeploymentCard, {
    global: { plugins: [pinia, i18n] }
  })
  return user
}

describe('WorkflowNeedsDeploymentCard', () => {
  it('names what the workflow lacks under the custom deployment pitch, without a video', () => {
    renderCard()

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
        'BiRefNet-general.safetensors'
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

  it('copies a brief that lists every missing pack, node and model', async () => {
    const user = renderCard()

    await user.click(screen.getByTestId('custom-deployment-agent'))

    const brief = await navigator.clipboard.readText()
    expect(brief).toContain('- Pack `comfyui-kjnodes`: `KJ`')
    expect(brief).toContain('- Pack unknown: `QwenImage21Cache`')
    expect(brief).toContain(
      '- `BiRefNet-general.safetensors` in `models/BiRefNet`'
    )
    expect(brief).not.toContain('OldSampler')
  })
})
