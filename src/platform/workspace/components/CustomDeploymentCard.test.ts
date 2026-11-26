import userEvent from '@testing-library/user-event'
import { render, screen, waitFor } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { downloadBlob } from '@/base/common/downloadUtil'
import type { useExternalLink } from '@/composables/useExternalLink'
import enMessages from '@/locales/en/main.json'
import { openAgentApp } from '@/platform/workflow/deploy/utils/agentApps'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import type { CustomDeploymentPitch } from '@/platform/workspace/customDeploymentPitch'

import CustomDeploymentCard from './CustomDeploymentCard.vue'

vi.mock(import('@/base/common/downloadUtil'), () => ({
  downloadBlob: vi.fn()
}))

vi.mock(import('@/platform/workflow/deploy/utils/agentApps'), () => ({
  openAgentApp: vi.fn()
}))

vi.mock(import('@/scripts/api'))
vi.mock(import('@/scripts/app'))
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

function renderCard(
  pitch: Partial<CustomDeploymentPitch> = {},
  videoSources: { src: string; type: string }[] = [],
  handsOverWorkflow = false
) {
  const user = userEvent.setup({ pointerEventsCheck: 0 })
  const onDone = vi.fn()
  const onDismiss = vi.fn()
  render(CustomDeploymentCard, {
    props: {
      pitch: {
        title: 'Deploy Custom Nodes on Comfy Cloud',
        body: 'Create a Custom Build that runs your custom nodes.',
        points: ['Deploy your node packs', 'Work on the GPU you choose'],
        platformLabel: 'Deploy on Platform',
        brief: '# The brief for an agent',
        ...pitch
      },
      videoSources,
      handsOverWorkflow,
      onDone,
      onDismiss
    },
    global: { plugins: [i18n] }
  })
  return { onDone, onDismiss, user }
}

async function pickRow(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByTestId('custom-deployment-agent'))
  await user.click(await screen.findByRole('menuitem', { name }))
}

function openWorkflow() {
  useWorkflowStore().activeWorkflow = fromPartial({
    filename: 'portrait',
    activeState: { nodes: [] },
    changeTracker: { prepareForSave: vi.fn() }
  })
}

function windowThatClosesAfterOpening(): Window {
  let reads = 0
  return fromPartial<Window>({
    get closed() {
      return reads++ > 0
    }
  })
}

function linkFollowedOnNextClick(): () => boolean {
  const followed: boolean[] = []
  document.addEventListener(
    'click',
    (event) => {
      followed.push(!event.defaultPrevented)
      event.preventDefault()
    },
    { once: true }
  )
  return () => followed.length === 1 && followed[0]
}

describe('CustomDeploymentCard', () => {
  it('shows the pitch it is given', () => {
    renderCard()

    expect(
      screen.getByRole('heading', {
        name: 'Deploy Custom Nodes on Comfy Cloud'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Create a Custom Build that runs your custom nodes.'
      )
    ).toBeVisible()
    expect(
      screen.getAllByRole('listitem').map((item) => item.textContent.trim())
    ).toEqual(['Deploy your node packs', 'Work on the GPU you choose'])
  })

  it('links to the platform in a new tab that sends no referrer from a local build, and reports done', async () => {
    const { onDone, user } = renderCard()
    const link = screen.getByRole('link', { name: 'Deploy on Platform' })

    expect(link).toHaveAttribute(
      'href',
      'https://platform.comfy.org/profile/builds?utm_source=comfyui&utm_medium=app&utm_content=custom-deployment-card'
    )
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    const followsLink = linkFollowedOnNextClick()
    await user.click(link)
    expect(followsLink()).toBe(true)
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('opens the build wizard itself on Cloud, in place of the link, when it hands over the open workflow', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    openWorkflow()
    const open = vi
      .spyOn(window, 'open')
      .mockReturnValue(windowThatClosesAfterOpening())
    const { onDone, user } = renderCard({}, [], true)

    const followsLink = linkFollowedOnNextClick()
    await user.click(screen.getByRole('link', { name: 'Deploy on Platform' }))

    expect(open).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(
        /^https:\/\/platform\.comfy\.org\/profile\/builds\/new\?step=import&handoff=[A-Za-z0-9_-]{16,64}&utm_source=comfy_cloud&utm_medium=app&utm_content=custom-deployment-card$/
      ),
      '_blank'
    )
    expect(followsLink()).toBe(false)
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('leaves the click to the link when it does not hand over the workflow', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    openWorkflow()
    const open = vi.spyOn(window, 'open')
    const { user } = renderCard()

    const followsLink = linkFollowedOnNextClick()
    await user.click(screen.getByRole('link', { name: 'Deploy on Platform' }))

    expect(open).not.toHaveBeenCalled()
    expect(followsLink()).toBe(true)
  })

  it.for(['Meta', 'Control', 'Shift', 'Alt'])(
    'leaves a %s click to the link',
    async (key) => {
      vi.stubGlobal('__DISTRIBUTION__', 'cloud')
      openWorkflow()
      const open = vi.spyOn(window, 'open')
      const { user } = renderCard({}, [], true)

      const followsLink = linkFollowedOnNextClick()
      await user.keyboard(`{${key}>}`)
      await user.click(screen.getByRole('link', { name: 'Deploy on Platform' }))

      expect(open).not.toHaveBeenCalled()
      expect(followsLink()).toBe(true)
    }
  )

  it.for([
    {
      video: 'has sources',
      sources: [{ src: 'deploy.mp4', type: 'video/mp4' }],
      shows: true
    },
    { video: 'has none', sources: [], shows: false }
  ])('shows the video only when it $video', ({ sources, shows }) => {
    renderCard({}, sources)

    expect(screen.queryByTestId('custom-deployment-video') !== null).toBe(shows)
  })

  it('offers a play control on its video', () => {
    renderCard({}, [{ src: 'deploy.mp4', type: 'video/mp4' }])

    expect(screen.getByRole('button', { name: 'Play' })).toBeInTheDocument()
  })

  it('lists what the workflow lacks when the pitch names it', () => {
    renderCard({
      missing: [
        {
          label: '2 missing node packs',
          names: 'comfyui-birefnet, comfyui-rmbg'
        },
        { label: '1 missing model', names: 'BiRefNet-general.safetensors' }
      ]
    })

    const missing = screen.getByTestId('custom-deployment-missing')
    expect(missing).toHaveTextContent(
      '2 missing node packscomfyui-birefnet, comfyui-rmbg1 missing modelBiRefNet-general.safetensors'
    )
  })

  it('keeps its label on a menu that offers Claude, Codex and a copy', async () => {
    const { user } = renderCard()
    const trigger = screen.getByTestId('custom-deployment-agent')

    expect(trigger).toHaveTextContent('Build with your agent')
    await user.click(trigger)

    expect(
      (await screen.findAllByRole('menuitem')).map((item) =>
        item.textContent.trim()
      )
    ).toEqual(['Open in Claude desktop', 'Open in Codex', 'Copy prompt'])
  })

  it.for([
    { row: 'Open in Claude desktop', app: 'claude' },
    { row: 'Open in Codex', app: 'codex' }
  ])(
    '$row starts the app with the brief and stays open',
    async ({ row, app }) => {
      const { onDone, user } = renderCard()

      await pickRow(user, row)

      expect(openAgentApp).toHaveBeenCalledWith(app, '# The brief for an agent')
      expect(downloadBlob).not.toHaveBeenCalled()
      expect(onDone).not.toHaveBeenCalled()
    }
  )

  it('copies the brief for an agent, then says so and stays open', async () => {
    const { onDone, user } = renderCard()

    await pickRow(user, 'Copy prompt')

    await waitFor(() =>
      expect(screen.getByTestId('custom-deployment-agent')).toHaveTextContent(
        /^Copied/
      )
    )
    expect(await navigator.clipboard.readText()).toBe(
      '# The brief for an agent'
    )
    expect(downloadBlob).not.toHaveBeenCalled()
    expect(onDone).not.toHaveBeenCalled()
  })

  it('keeps the original label and downloads nothing when the brief did not reach the clipboard', async () => {
    const { user } = renderCard({
      workflow: { fileName: 'portrait.json', serialize: () => '{}' }
    })
    vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(
      new Error('Clipboard permission denied')
    )

    await pickRow(user, 'Copy prompt')

    await waitFor(() =>
      expect(screen.getByTestId('custom-deployment-agent')).not.toHaveAttribute(
        'data-state',
        'open'
      )
    )
    expect(screen.getByTestId('custom-deployment-agent')).toHaveTextContent(
      'Build with your agent'
    )
    expect(downloadBlob).not.toHaveBeenCalled()
  })

  it('downloads the workflow when it opens an app with a brief that names one', async () => {
    const activeState = { nodes: [{ id: 1, type: 'BiRefNet' }] }
    const { user } = renderCard({
      workflow: {
        fileName: 'portrait.json',
        serialize: () => JSON.stringify(activeState)
      }
    })

    await pickRow(user, 'Open in Claude desktop')

    const [fileName, blob] = vi.mocked(downloadBlob).mock.calls[0]
    expect(fileName).toBe('portrait.json')
    expect(JSON.parse(await blob.text())).toEqual(activeState)
    expect(openAgentApp).toHaveBeenCalledWith(
      'claude',
      '# The brief for an agent'
    )
  })

  it('reports dismiss from the close control', async () => {
    const { onDismiss, onDone, user } = renderCard()

    await user.click(screen.getByRole('button', { name: /close/i }))

    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onDone).not.toHaveBeenCalled()
  })
})
