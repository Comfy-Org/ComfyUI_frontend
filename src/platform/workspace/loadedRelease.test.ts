import { PromptExecutionError } from '@comfyorg/api-client/ComfyApi'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { skipLeavePromptOnce } from '@/platform/workflow/management/leavePrompt'
import { workspaceApi } from '@/platform/workspace/api/workspaceApi'
import { confirmUnsavedWorkBeforeSwitch } from '@/platform/workspace/confirmUnsavedWorkBeforeSwitch'
import { reloadForDeploymentSwitch } from '@/platform/workspace/deploymentSwitchReload'
import { useDeploymentPickStore } from '@/platform/workspace/stores/deploymentPickStore'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import {
  handledReleaseChange,
  loadedReleaseId,
  takeReleaseKeptForReload
} from './loadedRelease'

vi.mock(import('@/composables/useFeatureFlags'))
vi.mock(import('@/platform/workspace/confirmUnsavedWorkBeforeSwitch'))
vi.mock(import('@/platform/workspace/deploymentSwitchReload'))
vi.mock(import('@/platform/workflow/management/leavePrompt'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry/reportError'))

const distribution = vi.hoisted(() => ({ isCloud: true }))
vi.mock(import('@/platform/distribution/types'), () => ({
  get isCloud() {
    return distribution.isCloud
  },
  isDesktop: false,
  isNightly: false
}))

type WorkspaceDeploymentList = Awaited<
  ReturnType<typeof workspaceApi.listDeployments>
>

const D2 = 'dep-a2a2a2a2-0000-4000-8000-000000000002'
const KEPT_RELEASE_KEY = 'Comfy.Deployment.ReleaseForReload'

function listing(
  pickedDeploymentId: string | null,
  version: number | undefined = 3,
  production: { release_id: string; release_version: number } = {
    release_id: 'r-2',
    release_version: 2
  }
): WorkspaceDeploymentList {
  return {
    builds_visible: true,
    ...(pickedDeploymentId === null
      ? {}
      : { picked_deployment_id: pickedDeploymentId }),
    items: [
      {
        deployment_id: D2,
        deployment_name: 'production',
        build_id: 'b-1',
        build_name: 'Studio Build',
        ...production,
        status: 'ready',
        can_start: false,
        created_at: '2026-10-01T00:00:00Z'
      },
      {
        deployment_id: 'dep-b3b3b3b3-0000-4000-8000-000000000003',
        deployment_name: 'staging',
        release_id: 'r-3',
        build_id: 'b-1',
        build_name: 'Studio Build',
        release_version: version,
        status: 'ready',
        can_start: false,
        created_at: '2026-10-02T00:00:00Z'
      }
    ]
  }
}

async function bootOn(pickedDeploymentId: string | null = D2) {
  vi.spyOn(workspaceApi, 'listDeployments').mockResolvedValue(
    listing(pickedDeploymentId)
  )
  vi.spyOn(workspaceApi, 'getReleaseUnsupportedPacks').mockResolvedValue({
    release_id: 'r-2',
    packs: []
  })
  await useDeploymentPickStore().load()
}

async function listingMovesProductionTo(releaseId: string, version: number) {
  vi.spyOn(workspaceApi, 'listDeployments').mockResolvedValue(
    listing(D2, 3, { release_id: releaseId, release_version: version })
  )
  await useDeploymentPickStore().load()
}

function reloadWhileListingSays(releaseId: string) {
  takeReleaseKeptForReload()
  useDeploymentPickStore().bootDeployment = {
    ...listing(D2).items[0],
    release_id: releaseId
  }
}

function refusal(error: unknown, status = 409) {
  return new PromptExecutionError({ error }, status)
}

const releaseChanged = refusal({
  type: 'RELEASE_CHANGED',
  message: 'The deployment moved to another release.',
  release_id: 'r-3'
})

describe('loadedReleaseId', () => {
  beforeEach(() => {
    distribution.isCloud = true
    Object.assign(useFeatureFlags().flags, {
      customDeploymentsEditorEnabled: true
    })
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    sessionStorage.clear()
    takeReleaseKeptForReload()
  })

  it('names the release this page booted on a custom deployment', async () => {
    await bootOn()

    expect(loadedReleaseId()).toBe('r-2')
  })

  it('names nothing on Comfy Cloud', async () => {
    await bootOn(null)

    expect(loadedReleaseId()).toBeUndefined()
  })

  it('names nothing with the flag off', async () => {
    Object.assign(useFeatureFlags().flags, {
      customDeploymentsEditorEnabled: false
    })
    await bootOn()

    expect(loadedReleaseId()).toBeUndefined()
  })

  it('names nothing outside Cloud', async () => {
    distribution.isCloud = false
    await bootOn()

    expect(loadedReleaseId()).toBeUndefined()
  })

  it('names nothing before the listing answers', () => {
    expect(loadedReleaseId()).toBeUndefined()
  })

  it('names the release kept at a refusal, for the one page that boots after it', async () => {
    await bootOn()
    handledReleaseChange(releaseChanged)

    takeReleaseKeptForReload()
    expect(loadedReleaseId()).toBe('r-3')
    expect(sessionStorage.getItem(KEPT_RELEASE_KEY)).toBeNull()

    takeReleaseKeptForReload()
    expect(loadedReleaseId()).toBe('r-2')
  })

  it.for([
    { booted: 'r-2', listed: 'r-2', loaded: 'r-3' },
    { booted: 'r-2', listed: 'r-3', loaded: 'r-3' },
    { booted: 'r-2', listed: 'r-4', loaded: 'r-4' },
    { booted: 'r-1', listed: 'r-2', loaded: 'r-3' },
    { booted: 'r-1', listed: 'r-1', loaded: 'r-3' }
  ])(
    'booted on $booted with the listing at r-2, after a refusal naming r-3, names $loaded when the reloaded listing says $listed',
    async ({ booted, listed, loaded }) => {
      await bootOn()
      useDeploymentPickStore().bootDeployment = {
        ...listing(D2).items[0],
        release_id: booted
      }
      handledReleaseChange(releaseChanged)

      reloadWhileListingSays(listed)

      expect(loadedReleaseId()).toBe(loaded)
    }
  )

  it('names the newest release after two refusals while the listing lags a release behind each time', async () => {
    await bootOn()
    handledReleaseChange(releaseChanged)
    reloadWhileListingSays('r-2')
    expect(loadedReleaseId()).toBe('r-3')

    handledReleaseChange(
      refusal({ type: 'RELEASE_CHANGED', message: '', release_id: 'r-4' })
    )
    reloadWhileListingSays('r-3')

    expect(loadedReleaseId()).toBe('r-4')
  })

  it('ignores a kept release for another deployment', async () => {
    sessionStorage.setItem(
      KEPT_RELEASE_KEY,
      JSON.stringify({
        deploymentId: 'dep-other',
        staleReleaseIds: ['r-2'],
        releaseId: 'r-9'
      })
    )
    takeReleaseKeptForReload()
    await bootOn()

    expect(loadedReleaseId()).toBe('r-2')
  })

  it('ignores a kept release it cannot read', async () => {
    sessionStorage.setItem(KEPT_RELEASE_KEY, '{"deploymentId":1}')
    takeReleaseKeptForReload()
    await bootOn()

    expect(loadedReleaseId()).toBe('r-2')
  })
})

describe('handledReleaseChange', () => {
  beforeEach(async () => {
    distribution.isCloud = true
    Object.assign(useFeatureFlags().flags, {
      customDeploymentsEditorEnabled: true
    })
    Object.assign(useTeamWorkspaceStore(), { workspaceId: 'ws-1' })
    sessionStorage.clear()
    takeReleaseKeptForReload()
    await bootOn()
  })

  it('asks for a reload naming the new version of the deployment this page booted on', async () => {
    await listingMovesProductionTo('r-4', 4)

    expect(
      handledReleaseChange(
        refusal({ type: 'RELEASE_CHANGED', message: '', release_id: 'r-4' })
      )
    ).toBe(true)

    const { toasts } = useToast()
    expect(toasts).toHaveLength(1)
    expect(toasts[0]).toMatchObject({
      kind: 'info',
      title: 'Studio Build · production now runs v4. Reload to run on it.'
    })
    expect(toasts[0].actions.map((action) => action.label)).toEqual(['Reload'])
  })

  it('names the deployment this page booted on when it moves to a release another deployment already runs', async () => {
    vi.mocked(confirmUnsavedWorkBeforeSwitch).mockResolvedValue(true)
    const moved = listing(D2, 3, { release_id: 'r-3', release_version: 3 })
    moved.items.reverse()
    vi.spyOn(workspaceApi, 'listDeployments').mockResolvedValue(moved)
    await useDeploymentPickStore().load()

    handledReleaseChange(releaseChanged)

    const { toasts } = useToast()
    expect(toasts[0].title).toBe(
      'Studio Build · production now runs v3. Reload to run on it.'
    )

    toasts[0].actions[0].onClick()
    await vi.advanceTimersByTimeAsync(0)

    expect(confirmUnsavedWorkBeforeSwitch).toHaveBeenCalledWith(
      'Studio Build · production',
      { reload: true }
    )
  })

  it('names no deployment when the listing still shows the old release and another deployment runs the refused one', async () => {
    vi.mocked(confirmUnsavedWorkBeforeSwitch).mockResolvedValue(true)
    handledReleaseChange(releaseChanged)

    const { toasts } = useToast()
    expect(toasts[0].title).toBe(
      'Runs now go to a different version. Reload to run on it.'
    )

    toasts[0].actions[0].onClick()
    await vi.advanceTimersByTimeAsync(0)

    expect(confirmUnsavedWorkBeforeSwitch).toHaveBeenCalledWith(
      'the new version',
      { reload: true }
    )
  })

  it('names no deployment for the browser pick while the listing still shows the old release', async () => {
    vi.mocked(confirmUnsavedWorkBeforeSwitch).mockResolvedValue(true)
    vi.spyOn(workspaceApi, 'listDeployments').mockResolvedValue({
      ...listing(D2),
      pick_source: 'browser'
    })
    await useDeploymentPickStore().load()

    handledReleaseChange(
      refusal({ type: 'RELEASE_CHANGED', message: '', release_id: 'r-4' })
    )

    const { toasts } = useToast()
    expect(toasts[0].title).toBe(
      'Runs now go to a different version. Reload to run on it.'
    )

    toasts[0].actions[0].onClick()
    await vi.advanceTimersByTimeAsync(0)

    expect(confirmUnsavedWorkBeforeSwitch).toHaveBeenCalledWith(
      'the new version',
      { reload: true }
    )
  })

  it('names no deployment when another tab moved the browser pick to the refused release', async () => {
    vi.mocked(confirmUnsavedWorkBeforeSwitch).mockResolvedValue(true)
    vi.spyOn(workspaceApi, 'listDeployments').mockResolvedValue({
      ...listing(D2),
      pick_source: 'browser'
    })
    await useDeploymentPickStore().load()

    handledReleaseChange(releaseChanged)

    const { toasts } = useToast()
    expect(toasts[0].title).toBe(
      'Runs now go to a different version. Reload to run on it.'
    )

    toasts[0].actions[0].onClick()
    await vi.advanceTimersByTimeAsync(0)

    expect(confirmUnsavedWorkBeforeSwitch).toHaveBeenCalledWith(
      'the new version',
      { reload: true }
    )
    expect(reloadForDeploymentSwitch).toHaveBeenCalledOnce()
  })

  it('names the new workspace default once the listing shows the move', async () => {
    vi.mocked(confirmUnsavedWorkBeforeSwitch).mockResolvedValue(true)
    vi.spyOn(workspaceApi, 'listDeployments').mockResolvedValue({
      ...listing('dep-b3b3b3b3-0000-4000-8000-000000000003'),
      pick_source: 'workspace_default'
    })
    await useDeploymentPickStore().load()

    handledReleaseChange(releaseChanged)

    const { toasts } = useToast()
    expect(toasts[0].title).toBe(
      'Studio Build · staging now runs v3. Reload to run on it.'
    )

    toasts[0].actions[0].onClick()
    await vi.advanceTimersByTimeAsync(0)

    expect(confirmUnsavedWorkBeforeSwitch).toHaveBeenCalledWith(
      'Studio Build · staging',
      { reload: true }
    )
  })

  it('names the deployment without a version when the listing has none for the refused release', async () => {
    const unversioned = listing('dep-b3b3b3b3-0000-4000-8000-000000000003')
    delete unversioned.items[1].release_version
    vi.spyOn(workspaceApi, 'listDeployments').mockResolvedValue({
      ...unversioned,
      pick_source: 'workspace_default'
    })
    await useDeploymentPickStore().load()

    handledReleaseChange(releaseChanged)

    expect(useToast().toasts[0].title).toBe(
      'Studio Build · staging now runs a different version. Reload to run on it.'
    )
  })

  it('shows one notice for repeated refusals', () => {
    handledReleaseChange(releaseChanged)
    handledReleaseChange(releaseChanged)

    expect(useToast().toasts).toHaveLength(1)
  })

  it.for([
    {
      name: 'names a release the listing does not have',
      error: refusal({
        type: 'RELEASE_CHANGED',
        message: '',
        release_id: 'r-7'
      })
    },
    {
      name: 'names no release',
      error: refusal({ type: 'RELEASE_CHANGED', message: '' })
    }
  ])('names no deployment when the refusal $name', async ({ error }) => {
    vi.mocked(confirmUnsavedWorkBeforeSwitch).mockResolvedValue(true)
    handledReleaseChange(error)

    const { toasts } = useToast()
    expect(toasts[0].title).toBe(
      'Runs now go to a different version. Reload to run on it.'
    )

    toasts[0].actions[0].onClick()
    await vi.advanceTimersByTimeAsync(0)

    expect(confirmUnsavedWorkBeforeSwitch).toHaveBeenCalledWith(
      'the new version',
      { reload: true }
    )
  })

  it('keeps nothing when the refusal names no release', () => {
    expect(
      handledReleaseChange(refusal({ type: 'RELEASE_CHANGED', message: '' }))
    ).toBe(true)

    expect(sessionStorage.getItem(KEPT_RELEASE_KEY)).toBeNull()
  })

  it.for([
    { name: 'another 409', error: refusal({ type: 'conflict', message: '' }) },
    {
      name: 'a RELEASE_CHANGED that is not a 409',
      error: refusal({ type: 'RELEASE_CHANGED', message: '' }, 400)
    },
    { name: 'a plain error', error: new Error('offline') }
  ])('leaves $name to the usual handling', ({ error }) => {
    expect(handledReleaseChange(error)).toBe(false)

    expect(useToast().toasts).toEqual([])
    expect(sessionStorage.getItem(KEPT_RELEASE_KEY)).toBeNull()
  })

  it('reloads from Reload once unsaved work is settled', async () => {
    vi.mocked(confirmUnsavedWorkBeforeSwitch).mockResolvedValue(true)
    await listingMovesProductionTo('r-4', 4)
    handledReleaseChange(
      refusal({ type: 'RELEASE_CHANGED', message: '', release_id: 'r-4' })
    )

    useToast().toasts[0].actions[0].onClick()
    await vi.advanceTimersByTimeAsync(0)

    expect(confirmUnsavedWorkBeforeSwitch).toHaveBeenCalledWith(
      'Studio Build · production',
      { reload: true }
    )
    expect(skipLeavePromptOnce).toHaveBeenCalledOnce()
    expect(reloadForDeploymentSwitch).toHaveBeenCalledOnce()
  })

  it('stays put when the person keeps their unsaved work', async () => {
    vi.mocked(confirmUnsavedWorkBeforeSwitch).mockResolvedValue(false)
    handledReleaseChange(releaseChanged)

    useToast().toasts[0].actions[0].onClick()
    await vi.advanceTimersByTimeAsync(0)

    expect(reloadForDeploymentSwitch).not.toHaveBeenCalled()
  })
})
