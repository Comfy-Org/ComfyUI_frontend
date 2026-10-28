import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'
import { createI18n } from 'vue-i18n'

import type { useExternalLink } from '@/composables/useExternalLink'
import enMessages from '@/locales/en/main.json'
import { useTelemetry } from '@/platform/telemetry'
import { useAgentHandoff } from '@/platform/workflow/deploy/composables/useAgentHandoff'
import { useInstallationDeploy } from '@/platform/workflow/deploy/composables/useInstallationDeploy'
import type { BuildInputs } from '@/platform/workflow/deploy/utils/buildInputs'

import DeployToComfyApiCard from './DeployToComfyApiCard.vue'

type InstallationDeployState = ReturnType<
  typeof useInstallationDeploy
>['state']['value']

const BUILDER_URL =
  'https://platform.comfy.org/profile/builds/new?step=import&bundle=b-1&workspace=ws-1'

vi.mock(import('@/platform/telemetry'))

vi.mock(
  import('@/platform/workflow/deploy/composables/useAgentHandoff'),
  () => {
    const copyBrief = vi.fn(() => Promise.resolve(true))
    const inputs = {
      models: ['sd_xl_base_1.0.safetensors'],
      nodeClasses: ['CheckpointLoaderSimple', 'KSampler'],
      nodePacks: [{ id: 'comfy-core', versions: [] }],
      workflowFileName: 'portrait-upscale.json',
      workflowName: 'portrait-upscale'
    } satisfies BuildInputs
    return {
      useAgentHandoff: () => ({ captureInputs: () => inputs, copyBrief })
    }
  }
)

vi.mock(
  import('@/platform/workflow/deploy/composables/useInstallationDeploy'),
  () => ({ useInstallationDeploy: vi.fn() })
)

function fakeInstallationDeploy(state: InstallationDeployState) {
  const installation = { state: ref(state), deploy: vi.fn(async () => {}) }
  vi.mocked(useInstallationDeploy).mockReturnValueOnce(installation)
  return installation
}

vi.mock(import('@/config/comfyApi'), () => ({
  getComfyPlatformBaseUrl: () => 'https://platform.comfy.org'
}))

vi.mock(import('@/composables/useExternalLink'), () => {
  const buildDocsUrl = vi.fn(
    (path: string, _options?: { includeLocale?: boolean }) =>
      `https://docs.comfy.org${path}`
  )
  return {
    useExternalLink: () =>
      fromPartial<ReturnType<typeof useExternalLink>>({ buildDocsUrl })
  }
})

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function renderCard(
  media: Partial<ComponentProps<typeof DeployToComfyApiCard>> = {}
) {
  const onDone = vi.fn()
  const onDismiss = vi.fn()
  render(DeployToComfyApiCard, {
    props: { onDone, onDismiss, ...media },
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
  })

  it('links to the platform developer docs', () => {
    renderCard()

    const docs = 'https://docs.comfy.org/development/overview'
    expect(
      screen
        .getAllByRole('link', { name: /read the docs/i })
        .map((link) => link.getAttribute('href'))
    ).toEqual([docs, docs])
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

    expect(useAgentHandoff().copyBrief).toHaveBeenCalledOnce()
    expect(screen.getByTestId('deploy-to-comfy-api-agent')).toHaveTextContent(
      /^Copied/
    )
    expect(onDone).not.toHaveBeenCalled()
  })

  it('keeps the original label when the brief did not reach the clipboard', async () => {
    vi.mocked(useAgentHandoff().copyBrief).mockResolvedValueOnce(false)
    const { user } = renderCard()

    await user.click(screen.getByTestId('deploy-to-comfy-api-agent'))

    expect(screen.getByTestId('deploy-to-comfy-api-agent')).toHaveTextContent(
      'Build with your agent'
    )
  })

  it('drops the copied label when a later copy fails', async () => {
    const { user } = renderCard()
    const button = screen.getByTestId('deploy-to-comfy-api-agent')
    await user.click(button)
    vi.mocked(useAgentHandoff().copyBrief).mockResolvedValueOnce(false)

    await user.click(button)

    expect(button).toHaveTextContent('Build with your agent')
  })

  it('links to the developer platform in a new tab without a referrer, and reports done', async () => {
    const { onDone, user } = renderCard()
    const link = screen.getByRole('link', { name: 'Deploy on Platform' })

    expect(link).toHaveAttribute('href', 'https://platform.comfy.org')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    await user.click(link)
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('shows its media over the poster', () => {
    renderCard({
      videoSources: [
        { src: 'https://example.test/a.webm', type: 'video/webm' },
        { src: 'https://example.test/a.mp4', type: 'video/mp4' }
      ],
      posterSrc: 'https://example.test/a.jpg'
    })

    expect(screen.getByTestId('deploy-to-comfy-api-video')).toHaveAttribute(
      'poster',
      'https://example.test/a.jpg'
    )
    expect(
      screen.queryByTestId('deploy-to-comfy-api-video-placeholder')
    ).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it('uploads the installation from Deploy on Platform and keeps the dialog open', async () => {
    const { deploy } = fakeInstallationDeploy({ status: 'idle' })
    const { onDone, user } = renderCard({ deploysInstallation: true })

    await user.click(screen.getByRole('button', { name: 'Deploy on Platform' }))

    expect(deploy).toHaveBeenCalledOnce()
    expect(onDone).not.toHaveBeenCalled()
    expect(
      useTelemetry()?.trackUiButtonClicked
    ).toHaveBeenCalledExactlyOnceWith({
      button_id: 'deploy_to_comfy_api_platform_clicked',
      element_group: 'deploy_to_comfy_api'
    })
  })

  it.for([
    { gesture: 'click', keys: '[MouseLeft]' },
    { gesture: 'middle-click', keys: '[MouseMiddle]' }
  ])(
    'links to the build wizard once the bundle is ready, and reports done on $gesture',
    async ({ keys }) => {
      fakeInstallationDeploy({ status: 'ready', url: BUILDER_URL })
      const { onDone, user } = renderCard({ deploysInstallation: true })
      const link = screen.getByRole('link', { name: 'Open the build wizard' })

      expect(link).toHaveAttribute('href', BUILDER_URL)
      await user.pointer({ keys, target: link })

      expect(onDone).toHaveBeenCalledOnce()
      expect(
        useTelemetry()?.trackUiButtonClicked
      ).toHaveBeenCalledExactlyOnceWith({
        button_id: 'deploy_to_comfy_api_builder_opened',
        element_group: 'deploy_to_comfy_api'
      })
    }
  )

  it('keeps the dialog open when the build wizard link is right-clicked', async () => {
    fakeInstallationDeploy({ status: 'ready', url: BUILDER_URL })
    const { onDone, user } = renderCard({ deploysInstallation: true })

    await user.pointer({
      keys: '[MouseRight]',
      target: screen.getByRole('link', { name: 'Open the build wizard' })
    })

    expect(onDone).not.toHaveBeenCalled()
  })

  it('shows the placeholder when there is no video', () => {
    renderCard()

    expect(
      screen.getByTestId('deploy-to-comfy-api-video-placeholder')
    ).toBeInTheDocument()
  })
})
