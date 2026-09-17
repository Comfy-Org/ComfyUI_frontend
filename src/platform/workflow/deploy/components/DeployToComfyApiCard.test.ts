import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import type { useExternalLink } from '@/composables/useExternalLink'
import enMessages from '@/locales/en/main.json'
import type { BuildInputs } from '@/platform/workflow/deploy/utils/buildInputs'

import DeployToComfyApiCard from './DeployToComfyApiCard.vue'

const copyToClipboard = vi.hoisted(() => vi.fn(() => Promise.resolve(true)))
vi.mock(import('@/composables/useCopyToClipboard'), () => ({
  useCopyToClipboard: () => ({ copyToClipboard })
}))

const exportWorkflow = vi.hoisted(() => vi.fn(() => Promise.resolve()))
vi.mock<unknown>(
  import('@/platform/workflow/core/services/workflowService'),
  () => ({
    useWorkflowService: () => ({ exportWorkflow })
  })
)

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

vi.mock(import('@/composables/useExternalLink'), () => ({
  useExternalLink: () =>
    fromPartial<ReturnType<typeof useExternalLink>>({
      buildDocsUrl: (path: string) => `https://docs.comfy.org${path}`
    })
}))

const inputs: BuildInputs = {
  workflowName: 'portrait-upscale',
  workflowFileName: 'portrait-upscale.json',
  nodeClasses: ['CheckpointLoaderSimple', 'KSampler'],
  nodePacks: ['comfy-core'],
  models: ['sd_xl_base_1.0.safetensors']
}

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderCard(requiresExport = false) {
  const onDone = vi.fn()
  const onDismiss = vi.fn()
  render(DeployToComfyApiCard, {
    props: {
      inputs,
      handoff: '# the brief',
      requiresExport,
      onDone,
      onDismiss
    },
    global: { plugins: [i18n] }
  })
  return { onDone, onDismiss, user: userEvent.setup() }
}

describe('DeployToComfyApiCard', () => {
  it('summarises what the graph puts into the Build', () => {
    renderCard()

    expect(
      screen.getByTestId('deploy-to-comfy-api-summary').textContent
    ).toContain('1 node pack · 1 model · 2 node classes')
    expect(
      screen.getByTestId('deploy-to-comfy-api-video-placeholder')
    ).toBeInTheDocument()
  })

  it('links to the platform developer docs', () => {
    renderCard()

    for (const link of screen.getAllByRole('link', {
      name: /read the docs/i
    })) {
      expect(link).toHaveAttribute(
        'href',
        'https://docs.comfy.org/development/overview'
      )
    }
  })

  it('reports dismiss from the close control', async () => {
    const { onDismiss, onDone, user } = renderCard()

    await user.click(screen.getByRole('button', { name: /close/i }))

    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('copies the brief, then says so on the button and stays open', async () => {
    const { onDone, user } = renderCard()

    await user.click(screen.getByTestId('deploy-to-comfy-api-agent'))

    expect(copyToClipboard).toHaveBeenCalledWith('# the brief', {
      toastOnSuccess: false
    })
    expect(exportWorkflow).not.toHaveBeenCalled()
    expect(screen.getByTestId('deploy-to-comfy-api-agent')).toHaveTextContent(
      /^Copied/
    )
    expect(onDone).not.toHaveBeenCalled()
  })

  it('keeps the original label when the copy fails', async () => {
    copyToClipboard.mockResolvedValueOnce(false)
    const { user } = renderCard()

    await user.click(screen.getByTestId('deploy-to-comfy-api-agent'))

    expect(screen.getByTestId('deploy-to-comfy-api-agent')).toHaveTextContent(
      'Deploy with your agent'
    )
  })

  it('exports the workflow before copying when the distribution needs it', async () => {
    const { user } = renderCard(true)

    await user.click(screen.getByTestId('deploy-to-comfy-api-agent'))

    expect(exportWorkflow).toHaveBeenCalledWith('portrait-upscale', 'workflow')
    expect(copyToClipboard).toHaveBeenCalledWith('# the brief', {
      toastOnSuccess: false
    })
  })

  it('opens the developer platform and reports done', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const { onDone, user } = renderCard()

    await user.click(screen.getByTestId('deploy-to-comfy-api-platform'))

    expect(open).toHaveBeenCalledWith(
      'https://platform.comfy.org',
      '_blank',
      'noopener'
    )
    expect(onDone).toHaveBeenCalledOnce()
  })
})
