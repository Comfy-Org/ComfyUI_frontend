import { getActivePinia } from 'pinia'
import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import type { useExternalLink } from '@/composables/useExternalLink'
import enMessages from '@/locales/en/main.json'
import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import {
  loadedEvent,
  reduceDeploymentPick
} from '@/platform/workspace/deploymentPickState'
import { useWorkflowStore } from '@/platform/workflow/management/stores/workflowStore'
import { reloadForDeploymentSwitch } from '@/platform/workspace/deploymentSwitchReload'
import { confirmUnsavedWorkBeforeSwitch } from '@/platform/workspace/confirmUnsavedWorkBeforeSwitch'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import type { DeploymentChoice } from '@/platform/workspace/workflowDeploymentOffer'

import SwitchDeploymentCard from './SwitchDeploymentCard.vue'

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

vi.mock(import('@/platform/workspace/confirmUnsavedWorkBeforeSwitch'), () => ({
  confirmUnsavedWorkBeforeSwitch: vi.fn(),
  unsavedWorkflows: vi.fn(() => [])
}))

vi.mock(import('@/platform/workspace/deploymentSwitchReload'), () => ({
  reloadForDeploymentSwitch: vi.fn(),
  takeDeploymentSwitchLanding: vi.fn(() => false)
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function deployment(id: string, name: string): WorkspaceDeployment {
  return {
    deployment_id: id,
    deployment_name: name,
    build_name: 'Acme Studio pipeline',
    release_id: `rel-${id}`,
    release_version: 4,
    status: 'ready',
    created_at: '2026-10-01T00:00:00Z',
    can_start: false
  }
}

const CHOICES: DeploymentChoice[] = [
  {
    deployment: deployment('dep-prod', 'Studio production'),
    mark: { kind: 'runs' }
  },
  {
    deployment: deployment('dep-staging', 'Studio staging'),
    mark: { kind: 'runs' }
  },
  {
    deployment: { ...deployment('dep-paused', 'Paused'), status: 'stopped' },
    mark: { kind: 'runs' }
  },
  {
    deployment: deployment('dep-exp', 'Experiments'),
    mark: { kind: 'missing', nodeTypes: ['BiRefNet_Zho'] }
  },
  { deployment: deployment('dep-old', 'Archive'), mark: { kind: 'unknown' } }
]

function renderCard() {
  const pinia = getActivePinia()!
  const pick = vi.spyOn(useDeploymentPickStore(pinia), 'pick')
  pick.mockResolvedValue(null)
  const onDone = vi.fn()
  const user = userEvent.setup()
  render(SwitchDeploymentCard, {
    props: {
      choices: CHOICES,
      missing: [
        {
          label: '2 missing node packs',
          names: 'ComfyUI-BiRefNet, ComfyUI-RMBG'
        }
      ],
      onDone
    },
    global: { plugins: [pinia, i18n] }
  })
  return { pick, onDone, user }
}

describe('SwitchDeploymentCard', () => {
  beforeEach(() => {
    vi.mocked(confirmUnsavedWorkBeforeSwitch).mockResolvedValue(true)
  })

  it('offers the first deployment that runs the workflow, with Create on Platform second', () => {
    renderCard()

    expect(
      screen.getByRole('heading', {
        name: 'Run this workflow on a custom deployment'
      })
    ).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Run on' })).toHaveTextContent(
      /^Acme Studio pipeline\s*Studio production\s*v4\s*Runs this workflow$/
    )
    expect(
      screen.getByRole('link', { name: /Create on Platform/ })
    ).toHaveAttribute(
      'href',
      'https://platform.comfy.org/profile/builds?utm_source=comfyui&utm_medium=app&utm_content=switch-deployment-card'
    )
  })

  it('switches to the chosen deployment once unsaved work is settled', async () => {
    const { pick, user } = renderCard()

    await user.click(screen.getByRole('combobox', { name: 'Run on' }))
    await user.click(await screen.findByRole('option', { name: /staging/ }))
    await user.click(screen.getByRole('button', { name: 'Switch' }))

    expect(confirmUnsavedWorkBeforeSwitch).toHaveBeenCalledWith(
      'Acme Studio pipeline · Studio staging'
    )
    expect(pick).toHaveBeenCalledWith('dep-staging')
  })

  it('lists the deployments that cannot run it muted, with what each lacks', async () => {
    const { user } = renderCard()

    await user.click(screen.getByRole('combobox', { name: 'Run on' }))

    expect(
      await screen.findByRole('option', { name: /Experiments/ })
    ).toHaveTextContent('Missing 1 node')
    expect(screen.getByRole('option', { name: /Experiments/ })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
    expect(screen.getByRole('option', { name: /Archive/ })).toHaveTextContent(
      'Not checked'
    )
    expect(
      screen.getByRole('option', { name: /Studio staging/ })
    ).not.toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('option', { name: /Paused/ })).toHaveTextContent(
      'Stopped'
    )
    expect(screen.getByRole('option', { name: /Paused/ })).toHaveAttribute(
      'aria-disabled',
      'true'
    )
  })

  it('reloads onto the deployment when this browser has already picked it since the page loaded', async () => {
    const { user } = renderCard()
    const store = useDeploymentPickStore()
    store.state = reduceDeploymentPick(
      { phase: 'idle' },
      loadedEvent({
        builds_visible: true,
        items: CHOICES.map((choice) => choice.deployment),
        picked_deployment_id: 'dep-prod'
      })
    )
    store.bootDeployment = null

    await user.click(screen.getByRole('button', { name: 'Switch' }))

    expect(reloadForDeploymentSwitch).toHaveBeenCalledWith(expect.any(Function))
  })

  it('stays on Comfy Cloud when the user cancels the save prompt', async () => {
    vi.mocked(confirmUnsavedWorkBeforeSwitch).mockResolvedValue(false)
    const { pick, user } = renderCard()

    await user.click(screen.getByRole('button', { name: 'Switch' }))

    expect(pick).not.toHaveBeenCalled()
  })

  it("shows the server's refusal as a toast and lets the user try again", async () => {
    const { pick, user } = renderCard()
    pick.mockResolvedValue('This deployment is stopped')

    await user.click(screen.getByRole('button', { name: 'Switch' }))

    expect(useToast().toasts).toContainEqual(
      expect.objectContaining({
        kind: 'error',
        title: 'Could not switch',
        description: 'This deployment is stopped'
      })
    )
    expect(screen.getByRole('button', { name: 'Switch' })).toBeEnabled()
  })

  it('opens the build wizard itself on Cloud, in place of the link, for the open workflow', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    useWorkflowStore().activeWorkflow = fromPartial({
      filename: 'portrait',
      activeState: { nodes: [] },
      changeTracker: { prepareForSave: vi.fn() }
    })
    const open = vi
      .spyOn(window, 'open')
      .mockReturnValue(fromPartial<Window>({ closed: false }))
    const followed: boolean[] = []
    document.addEventListener(
      'click',
      (event) => followed.push(!event.defaultPrevented),
      { once: true }
    )
    const { onDone, user } = renderCard()

    await user.click(screen.getByRole('link', { name: /Create on Platform/ }))

    expect(open).toHaveBeenCalledExactlyOnceWith(
      expect.stringMatching(
        /^https:\/\/platform\.comfy\.org\/profile\/builds\/new\?step=import&handoff=[A-Za-z0-9_-]{16,64}&utm_source=comfy_cloud&utm_medium=app&utm_content=switch-deployment-card$/
      ),
      '_blank'
    )
    expect(followed).toEqual([false])
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('leaves Create on Platform to the link while a switch is under way, because the reload would drop the answer', async () => {
    vi.stubGlobal('__DISTRIBUTION__', 'cloud')
    useWorkflowStore().activeWorkflow = fromPartial({
      filename: 'portrait',
      activeState: { nodes: [] },
      changeTracker: { prepareForSave: vi.fn() }
    })
    const open = vi.spyOn(window, 'open')
    vi.mocked(confirmUnsavedWorkBeforeSwitch).mockReturnValue(
      new Promise(() => {})
    )
    const followed: boolean[] = []
    const { user } = renderCard()
    await user.click(screen.getByRole('button', { name: 'Switch' }))
    document.addEventListener(
      'click',
      (event) => {
        followed.push(!event.defaultPrevented)
        event.preventDefault()
      },
      { once: true }
    )

    await user.click(screen.getByRole('link', { name: /Create on Platform/ }))

    expect(open).not.toHaveBeenCalled()
    expect(followed).toEqual([true])
  })

  it('closes when the user goes to create a deployment instead', async () => {
    const { onDone, user } = renderCard()

    await user.click(screen.getByRole('link', { name: /Create on Platform/ }))

    expect(onDone).toHaveBeenCalledOnce()
  })
})
