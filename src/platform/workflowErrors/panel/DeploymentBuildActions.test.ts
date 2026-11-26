import type { WorkspaceDeploymentList } from '@comfyorg/ingest-types'
import { render, screen, waitFor } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import type { MissingPackGroup } from '@/platform/workflowErrors/panel/useErrorGroups'
import type { MissingModelGroup } from '@/platform/workflowErrors/missingModel/types'
import type { WorkspaceDeployment } from '@/platform/workspace/api/workspaceApi'
import { DEPLOYMENT_LISTING_FOCUS_RETRY_MS } from '@/platform/workspace/api/deploymentListingTimeouts'
import { reloadForDeploymentSwitch } from '@/platform/workspace/deploymentSwitchReload'
import { useMissingNodesErrorStore } from '@/platform/workflowErrors/nodeReplacement/missingNodesErrorStore'
import { usePlatformFrameStore } from '@/platform/workspace/platformFrame/platformFrameStore'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { testI18n } from '@/utils/__tests__/testI18n'

import DeploymentBuildActions from './DeploymentBuildActions.vue'

const mockWorkspaceApi = vi.hoisted(() => ({
  listDeployments: vi.fn(),
  getReleaseUnsupportedPacks: vi.fn()
}))
vi.mock<unknown>(import('@/platform/workspace/api/workspaceApi'), () => ({
  workspaceApi: mockWorkspaceApi
}))
vi.mock(import('@/platform/workspace/deploymentSwitchReload'))

const deployment: WorkspaceDeployment = {
  deployment_id: 'dep-1',
  deployment_name: 'production',
  build_id: 'build-7',
  build_name: 'video-minimax-h3 copy',
  release_id: 'rel-3',
  status: 'ready',
  created_at: '2026-10-01T00:00:00Z',
  can_start: false
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

  it('offers no agent button', () => {
    renderActions()

    expect(
      screen.queryByRole('button', { name: /Build with your agent/ })
    ).not.toBeInTheDocument()
  })

  describe('with the Platform frame on', () => {
    beforeEach(() => {
      vi.spyOn(usePlatformFrameStore(), 'isAvailable').mockReturnValue(true)
      vi.spyOn(usePlatformFrameStore(), 'open').mockReturnValue(true)
    })

    it('opens the pre-install screen with the workflow when only models are missing', async () => {
      const user = renderActions({ missingPackGroups: [] })

      await user.click(
        screen.getByRole('link', {
          name: 'Add the missing models to the build'
        })
      )

      expect(usePlatformFrameStore().open).toHaveBeenCalledExactlyOnceWith(
        {
          step: 'preinstall',
          deploymentId: 'dep-1',
          handsOverWorkflow: true
        },
        'errors_panel'
      )
    })

    it('keeps the link to the Build when the workflow lacks nodes the panel hides', () => {
      useMissingNodesErrorStore().setMissingNodeTypes(['QwenImage21Cache'])
      renderActions({ missingPackGroups: [] })

      expect(
        screen.getByRole('link', { name: 'Edit build on Platform' })
      ).toBeInTheDocument()
      expect(usePlatformFrameStore().open).not.toHaveBeenCalled()
    })

    it.for([
      { missing: 'nodes are missing too', packs: missingPackGroups },
      { missing: 'no model is missing', packs: [] }
    ])('keeps the link to the Build when $missing', ({ packs }) => {
      renderActions({
        missingPackGroups: packs,
        ...(packs.length === 0 && { missingModelGroups: [] })
      })

      expect(
        screen.getByRole('link', { name: 'Edit build on Platform' })
      ).toBeInTheDocument()
      expect(usePlatformFrameStore().open).not.toHaveBeenCalled()
    })
  })

  describe('once the deployment changed after the page loaded', () => {
    function listingOn(running: WorkspaceDeployment): WorkspaceDeploymentList {
      return {
        builds_visible: true,
        picked_deployment_id: running.deployment_id,
        pick_source: 'browser',
        items: [running]
      }
    }

    async function bootOn(running: WorkspaceDeployment) {
      mockWorkspaceApi.listDeployments.mockResolvedValue(listingOn(running))
      await useDeploymentPickStore().loadOnce()
    }

    function returnToTheEditor() {
      window.dispatchEvent(new Event('focus'))
    }

    beforeEach(() => {
      mockWorkspaceApi.getReleaseUnsupportedPacks.mockResolvedValue({
        release_id: null,
        packs: []
      })
      Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    })

    it.for([
      {
        change: 'a new release',
        now: { ...deployment, release_id: 'rel-4' },
        message:
          'This deployment now runs a different Release. Reload to get its nodes.'
      },
      {
        change: 'on another deployment',
        now: {
          ...deployment,
          deployment_id: 'dep-2',
          deployment_name: 'staging',
          release_id: 'rel-9'
        },
        message: /This browser now runs on .*staging.*Reload to get its nodes\./
      }
    ])(
      'offers a reload instead of the Build when it runs $change',
      async ({ now, message }) => {
        await bootOn(deployment)
        const user = renderActions()
        mockWorkspaceApi.listDeployments.mockResolvedValue(listingOn(now))

        returnToTheEditor()

        expect(await screen.findByText(message)).toBeInTheDocument()
        expect(
          screen.queryByRole('link', { name: /on Platform/ })
        ).not.toBeInTheDocument()
        await user.click(screen.getByRole('button', { name: 'Reload' }))
        await waitFor(() =>
          expect(reloadForDeploymentSwitch).toHaveBeenCalledOnce()
        )
      }
    )

    it('checks for a change at most once a minute as the user returns', async () => {
      await bootOn(deployment)
      renderActions()
      mockWorkspaceApi.listDeployments.mockClear()

      returnToTheEditor()
      returnToTheEditor()
      expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledOnce()

      vi.advanceTimersByTime(DEPLOYMENT_LISTING_FOCUS_RETRY_MS)
      returnToTheEditor()
      expect(mockWorkspaceApi.listDeployments).toHaveBeenCalledTimes(2)
    })
  })
})
