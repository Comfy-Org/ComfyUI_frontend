import { getActivePinia } from 'pinia'
import userEvent from '@testing-library/user-event'
import { render, screen, within } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import { useToast } from '@/components/ui/toast/toastStore'
import type { useExternalLink } from '@/composables/useExternalLink'
import enMessages from '@/locales/en/main.json'
import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { buildCustomNodesService } from '@/platform/workspace/buildCustomNodes/buildCustomNodesService'
import {
  BUILD_CUSTOM_NODES_POLL_MS,
  useBuildCustomNodesStore
} from '@/platform/workspace/buildCustomNodes/buildCustomNodesStore'
import type {
  DeploymentBuild,
  NodePack,
  ReleaseBuild
} from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'

import BuildCustomNodesDialog from './BuildCustomNodesDialog.vue'

vi.mock(import('@/platform/workspace/buildCustomNodes/buildCustomNodesService'))

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

const DEPLOYMENT: WorkspaceDeployment = {
  deployment_id: 'dep-prod',
  deployment_name: 'production',
  build_id: 'bld-1',
  build_name: 'Studio Build',
  release_id: 'rel-3',
  release_version: 3,
  status: 'ready',
  created_at: '2026-10-01T00:00:00Z',
  can_start: false
}

const RGTHREE_ENTRY = {
  name: 'rgthree-comfy',
  id: 'rgthree-comfy',
  registryVersion: '1.0.2'
}

function deploymentBuild(
  overrides: Partial<DeploymentBuild> = {}
): DeploymentBuild {
  return {
    revision: 7,
    pending_update: null,
    release: { release_id: 'rel-3', version: 3 },
    build: {
      build_id: 'bld-1',
      name: 'Studio Build',
      updated_at: '2026-11-05T10:00:00Z',
      custom_nodes: [RGTHREE_ENTRY]
    },
    can_change_build: true,
    ...overrides
  }
}

function nodePack(id: string, name: string, latestVersion: string): NodePack {
  return {
    id,
    name,
    publisher: 'Dr.Lt.Data',
    installs: 3_600_000,
    stars: 3300,
    license: 'GPL-3.0',
    repository: `https://github.com/ltdrdata/${id}`,
    latestVersion
  }
}

const RGTHREE = {
  ...nodePack('rgthree-comfy', 'rgthree-comfy', '1.0.3'),
  publisher: 'rgthree'
}
const IMPACT = nodePack('comfyui-impact-pack', 'ComfyUI Impact Pack', '8.30.0')
const SUBPACK = nodePack(
  'comfyui-impact-subpack',
  'ComfyUI Impact Subpack',
  '1.3.5'
)

function release(overrides: Partial<ReleaseBuild> = {}): ReleaseBuild {
  return {
    release_id: 'rel-4',
    version: 4,
    status: 'building',
    deployable: false,
    target: { status: 'building' },
    timeline: [
      {
        phase: 'assemble',
        level: 'info',
        message: 'assemble',
        at: '2026-11-05T10:01:00Z'
      }
    ],
    ...overrides
  }
}

const BUILT = release({
  status: 'complete',
  deployable: true,
  target: { status: 'ready' }
})

const FAILED = release({
  status: 'complete',
  target: {
    status: 'failed',
    failure_reason:
      'ERROR: Cannot install comfyui-impact-pack==8.30.0 because these package versions have conflicting dependencies.'
  }
})

const service = vi.mocked(buildCustomNodesService)

async function renderDialog(build = deploymentBuild()) {
  service.getDeploymentBuild.mockResolvedValue({ ok: true, value: build })
  const pinia = getActivePinia()!
  const onDone = vi.fn()
  const onDismiss = vi.fn()
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  await useBuildCustomNodesStore(pinia).open(DEPLOYMENT)
  render(BuildCustomNodesDialog, {
    props: { onDone, onDismiss },
    global: { plugins: [pinia, i18n] }
  })
  return { user, onDone, onDismiss }
}

async function poll() {
  await vi.advanceTimersByTimeAsync(BUILD_CUSTOM_NODES_POLL_MS)
}

async function pickImpactAndReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('checkbox', {
      name: 'Add ComfyUI Impact Pack to the Build'
    })
  )
  await user.click(screen.getByRole('button', { name: 'Review 1 node pack' }))
}

describe('BuildCustomNodesDialog', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    service.searchNodePacks.mockResolvedValue({
      ok: true,
      value: { packs: [RGTHREE, IMPACT, SUBPACK], hasMore: false }
    })
    service.getNodePacks.mockResolvedValue([RGTHREE])
    service.getNodePackVersions.mockResolvedValue({
      ok: true,
      value: ['1.3.5', '1.3.4', '1.3.3']
    })
    service.saveCustomNodes.mockResolvedValue({
      ok: true,
      value: { updated_at: '2026-11-05T10:05:00Z' }
    })
    service.startRelease.mockResolvedValue({
      ok: true,
      value: { release_id: 'rel-4', version: 4 }
    })
    service.moveToRelease.mockResolvedValue({
      ok: true,
      value: {
        revision: 7,
        release_id: 'rel-3',
        pending_update: {
          release_id: 'rel-4',
          status: 'starting',
          since: '2026-11-05T10:10:00Z'
        }
      }
    })
    vi.spyOn(useDeploymentPickStore(), 'load').mockResolvedValue()
  })

  it("opens on the Build's own node packs, then the registry's packs to add", async () => {
    await renderDialog()

    expect(
      screen.getByRole('heading', { name: 'Add custom nodes to Studio Build' })
    ).toBeInTheDocument()
    const inBuild = (await screen.findAllByRole('row')).find((row) =>
      within(row).queryByText('In Build')
    )
    expect(inBuild).toHaveTextContent(/rgthree-comfy.*1\.0\.2/)
    expect(within(inBuild!).queryByRole('checkbox')).not.toBeInTheDocument()
    expect(
      screen.getByRole('checkbox', {
        name: 'Add ComfyUI Impact Pack to the Build'
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Review changes' })
    ).toBeDisabled()
  })

  it('searches the registry, and the review lists exactly the picked packs at their versions', async () => {
    const { user } = await renderDialog()

    await user.type(
      screen.getByRole('combobox', { name: 'Search node packs' }),
      'impact'
    )
    await vi.advanceTimersByTimeAsync(300)
    expect(service.searchNodePacks).toHaveBeenLastCalledWith('impact', 0)

    await user.click(
      await screen.findByRole('checkbox', {
        name: 'Add ComfyUI Impact Pack to the Build'
      })
    )
    await user.click(
      screen.getByRole('button', {
        name: 'Choose a version of ComfyUI Impact Subpack. 1.3.5 is picked now.'
      })
    )
    await user.click(await screen.findByRole('button', { name: '1.3.4' }))

    await user.click(
      screen.getByRole('button', {
        name: 'Choose a version of ComfyUI Impact Pack. 8.30.0 is picked now.'
      })
    )
    await user.click(
      await screen.findByRole('button', {
        name: 'Pin a commit hash for ComfyUI Impact Pack'
      })
    )
    const hash = screen.getByRole('textbox', { name: 'Commit hash' })
    await user.type(hash, 'main')
    await user.click(screen.getByRole('button', { name: 'Pin' }))
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Enter a commit hash of 7 to 40 letters and digits.'
    )
    await user.clear(hash)
    await user.type(hash, 'a1f3c9e')
    await user.click(screen.getByRole('button', { name: 'Pin' }))

    await user.click(
      screen.getByRole('button', { name: 'Review 2 node packs' })
    )

    expect(
      screen.getByRole('heading', { name: 'Add 2 node packs to Studio Build' })
    ).toBeInTheDocument()
    const items = within(
      screen.getByRole('list', { name: 'Node packs to add' })
    ).getAllByRole('listitem')
    expect(items).toHaveLength(2)
    expect(items[0]).toHaveTextContent(
      /^ComfyUI Impact Pack\s*Dr\.Lt\.Data\s*Pinned\s*a1f3c9e$/
    )
    expect(items[1]).toHaveTextContent(
      /^ComfyUI Impact Subpack\s*Dr\.Lt\.Data\s*Pinned\s*1\.3\.4$/
    )
  })

  it('adds the picks to the Build, builds a Release, then moves the deployment to it', async () => {
    service.getRelease.mockResolvedValueOnce({ ok: true, value: release() })
    service.getRelease.mockResolvedValueOnce({ ok: true, value: BUILT })
    const { user, onDone } = await renderDialog()
    await pickImpactAndReview(user)

    await user.click(screen.getByRole('button', { name: 'Add and redeploy' }))

    expect(service.saveCustomNodes).toHaveBeenCalledWith(
      'dep-prod',
      '2026-11-05T10:00:00Z',
      [
        RGTHREE_ENTRY,
        {
          name: 'ComfyUI Impact Pack',
          id: 'comfyui-impact-pack',
          registryVersion: '8.30.0'
        }
      ]
    )
    expect(
      await screen.findByRole('heading', { name: 'Building Release v4' })
    ).toBeInTheDocument()

    await poll()
    expect(
      screen.getByRole('progressbar', { name: 'Build progress' })
    ).toHaveAttribute('aria-valuetext', 'Step 2 of 4')

    service.getDeploymentBuild.mockResolvedValue({
      ok: true,
      value: deploymentBuild({ release: { release_id: 'rel-4', version: 4 } })
    })
    await poll()
    expect(
      screen.getByRole('heading', { name: 'Moving production to v4' })
    ).toBeInTheDocument()
    expect(service.moveToRelease).toHaveBeenCalledWith('dep-prod', 'rel-4', 7)

    await poll()
    expect(onDone).toHaveBeenCalled()
    expect(useToast().toasts.map((toast) => toast.title)).toContain(
      'production now runs Studio Build v4'
    )
  })

  it("shows the builder's message when the build fails, and Build again builds once more", async () => {
    service.getRelease.mockResolvedValueOnce({ ok: true, value: FAILED })
    const { user } = await renderDialog()
    await pickImpactAndReview(user)
    await user.click(screen.getByRole('button', { name: 'Add and redeploy' }))

    await poll()
    expect(
      screen.getByRole('heading', { name: "Release v4 didn't build" })
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Message from the builder')).toHaveTextContent(
      'Cannot install comfyui-impact-pack==8.30.0'
    )

    service.startRelease.mockResolvedValueOnce({
      ok: true,
      value: { release_id: 'rel-5', version: 5 }
    })
    await user.click(screen.getByRole('button', { name: 'Build again' }))

    expect(service.startRelease).toHaveBeenCalledTimes(2)
    expect(
      await screen.findByRole('heading', { name: 'Building Release v5' })
    ).toBeInTheDocument()
  })

  it('goes back to the picker with the picks kept when the user changes node packs after a failure', async () => {
    service.getRelease.mockResolvedValueOnce({ ok: true, value: FAILED })
    const { user } = await renderDialog()
    await pickImpactAndReview(user)
    await user.click(screen.getByRole('button', { name: 'Add and redeploy' }))
    await poll()

    await user.click(screen.getByRole('button', { name: 'Change node packs' }))

    expect(
      await screen.findByRole('checkbox', {
        name: 'Add ComfyUI Impact Pack to the Build'
      })
    ).toBeChecked()
  })

  it("lists the Build's packs without any way to change them for a viewer who may not change the Build", async () => {
    await renderDialog(deploymentBuild({ can_change_build: false }))

    expect(
      screen.getByRole('heading', { name: 'Custom nodes in Studio Build' })
    ).toBeInTheDocument()
    expect(
      within(
        screen.getByRole('list', { name: 'Node packs in Studio Build' })
      ).getByRole('listitem')
    ).toHaveTextContent(/rgthree-comfy\s*1\.0\.2/)
    expect(
      screen.queryByRole('combobox', { name: 'Search node packs' })
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
