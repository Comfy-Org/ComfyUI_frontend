import { beforeEach, expect, it, onTestFinished, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import * as registry from '@/services/comfyRegistryService'
import { useComfyRegistryStore } from '@/stores/comfyRegistryStore'
import type { components } from '@/types/comfyRegistryTypes'
import { useComfyManagerStore } from '@/platform/customNodes/manager/stores/comfyManagerStore'
import { usePackUpdateStatuses } from '@/platform/customNodes/manager/composables/nodePack/usePackUpdateStatuses'
import { usePackUpdateStatus } from '@/platform/customNodes/manager/composables/nodePack/usePackUpdateStatus'

type NodePack = components['schemas']['Node']
type NodeVersion = components['schemas']['NodeVersion']

const flaggedPack: NodePack = {
  id: 'sample-pack',
  latest_version: { version: '3.0.0', status: 'NodeVersionStatusFlagged' }
}

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

function setupVersions() {
  const service = registry.useComfyRegistryService()
  vi.spyOn(registry, 'useComfyRegistryService').mockReturnValue(service)
  return vi.spyOn(service, 'getPackVersions')
}

function scoped<T>(create: () => T) {
  const scope = effectScope()
  onTestFinished(() => scope.stop())
  const result = scope.run(create)
  if (!result) throw new Error('Scope did not initialize')
  return { result, stop: () => scope.stop() }
}

beforeEach(() => {
  vi.mocked(useComfyManagerStore().isPackInstalled).mockReturnValue(true)
  vi.mocked(useComfyManagerStore().getInstalledPackVersion).mockReturnValue(
    '1.0.0'
  )
})

it.for([
  { version: '1.0.0', available: false },
  { version: '2.0.0', available: true },
  { version: '2.1.0-beta.1', available: true },
  { version: undefined, available: false }
])(
  'uses the default update target $version beneath a flagged release',
  async ({ version, available }) => {
    const getVersions = setupVersions().mockResolvedValue(
      version ? [{ version, status: 'NodeVersionStatusActive' }] : []
    )
    const { result } = scoped(() => usePackUpdateStatuses([flaggedPack]))
    const { result: badge } = scoped(() => usePackUpdateStatus(flaggedPack))

    expect(result.isLoading.value).toBe(true)
    expect(badge.isUpdateAvailable.value).toBe(false)
    await vi.waitFor(() => expect(result.isLoading.value).toBe(false))

    expect(result.getStatus(flaggedPack).isUpdateAvailable).toBe(available)
    expect(badge.isUpdateAvailable.value).toBe(available)
    expect(badge.latestVersion.value).toBe(version)
    expect(getVersions).toHaveBeenCalledExactlyOnceWith(
      'sample-pack',
      {
        statuses: ['NodeVersionStatusActive']
      },
      expect.any(AbortSignal)
    )
    expect(flaggedPack.latest_version?.status).toBe('NodeVersionStatusFlagged')
  }
)

it('does not request versions for Active, uninstalled or nightly packs', () => {
  const getVersions = setupVersions()
  const activePack: NodePack = {
    id: 'active',
    latest_version: { version: '2.0.0', status: 'NodeVersionStatusActive' }
  }
  vi.mocked(useComfyManagerStore().isPackInstalled).mockImplementation(
    (id) => id !== 'uninstalled'
  )
  vi.mocked(useComfyManagerStore().getInstalledPackVersion).mockImplementation(
    (id) => (id === 'nightly' ? 'abc1234' : '1.0.0')
  )
  const { result } = scoped(() =>
    usePackUpdateStatuses([
      activePack,
      { ...flaggedPack, id: 'uninstalled' },
      { ...flaggedPack, id: 'nightly' }
    ])
  )
  expect(result.getStatus(activePack).isUpdateAvailable).toBe(true)
  expect(result.isLoading.value).toBe(false)
  expect(getVersions).not.toHaveBeenCalled()
})

it('reports lookup failures and retries when the view is reopened', async () => {
  const getVersions = setupVersions()
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce([
      { version: '2.0.0', status: 'NodeVersionStatusActive' }
    ])
  const first = scoped(() => usePackUpdateStatuses([flaggedPack]))
  await vi.waitFor(() => expect(first.result.hasError.value).toBe(true))
  expect(first.result.getStatus(flaggedPack).isUpdateAvailable).toBe(false)
  first.stop()

  const second = scoped(() => usePackUpdateStatuses([flaggedPack]))
  await vi.waitFor(() => expect(second.result.isLoading.value).toBe(false))
  expect(second.result.hasError.value).toBe(false)
  expect(second.result.getStatus(flaggedPack).isUpdateAvailable).toBe(true)
  expect(getVersions).toHaveBeenCalledTimes(2)
})

it('preserves successful update lookups when another pack fails', async () => {
  const failedPack = { ...flaggedPack, id: 'unavailable-pack' }
  const responses = new Map<string, NodeVersion[] | null>([
    ['sample-pack', [{ version: '2.0.0', status: 'NodeVersionStatusActive' }]],
    ['unavailable-pack', null]
  ])
  setupVersions().mockImplementation(
    async (id) => responses.get(id ?? '') ?? null
  )
  const { result } = scoped(() =>
    usePackUpdateStatuses([flaggedPack, failedPack])
  )

  await vi.waitFor(() => expect(result.isLoading.value).toBe(false))

  expect(result.hasError.value).toBe(true)
  expect(result.getStatus(flaggedPack).isUpdateAvailable).toBe(true)
  expect(result.getStatus(failedPack).isUpdateAvailable).toBe(false)
})

it('does not let a closed view cancel a shared version request', async () => {
  const pending = deferred<NodeVersion[]>()
  const getVersions = setupVersions().mockReturnValue(pending.promise)
  const first = scoped(() => usePackUpdateStatuses([flaggedPack]))
  const second = scoped(() => usePackUpdateStatuses([flaggedPack]))
  first.stop()
  pending.resolve([{ version: '2.0.0', status: 'NodeVersionStatusActive' }])
  await vi.waitFor(() => expect(second.result.isLoading.value).toBe(false))
  expect(second.result.getStatus(flaggedPack).isUpdateAvailable).toBe(true)
  expect(getVersions).toHaveBeenCalledTimes(1)
})

it('ignores an old lookup after the source pack changes', async () => {
  vi.useFakeTimers()
  const pending = deferred<NodeVersion[]>()
  setupVersions()
    .mockReturnValueOnce(pending.promise)
    .mockResolvedValueOnce([
      { version: '1.0.0', status: 'NodeVersionStatusActive' }
    ])
  const packs = ref([flaggedPack])
  const { result } = scoped(() => usePackUpdateStatuses(packs))
  packs.value = [{ ...flaggedPack, id: 'other-pack' }]
  await nextTick()
  await vi.waitFor(() => expect(result.isLoading.value).toBe(false))
  pending.resolve([{ version: '2.0.0', status: 'NodeVersionStatusActive' }])
  await pending.promise
  await nextTick()
  await vi.advanceTimersByTimeAsync(0)
  expect(result.getStatus(flaggedPack).isUpdateAvailable).toBe(false)
})

it('refreshes the target when advertised metadata changes or caches are cleared', async () => {
  const getVersions = setupVersions().mockResolvedValue([
    { version: '1.0.0', status: 'NodeVersionStatusActive' }
  ])
  const packs = ref([flaggedPack])
  const { result } = scoped(() => usePackUpdateStatuses(packs))
  await vi.waitFor(() => expect(result.isLoading.value).toBe(false))
  getVersions.mockResolvedValue([
    { version: '2.0.0', status: 'NodeVersionStatusActive' }
  ])
  packs.value = [
    {
      ...flaggedPack,
      latest_version: { version: '4.0.0', status: 'NodeVersionStatusPending' }
    }
  ]
  await nextTick()
  await vi.waitFor(() =>
    expect(result.getStatus(packs.value[0]).isUpdateAvailable).toBe(true)
  )
  expect(getVersions).toHaveBeenCalledTimes(2)
  useComfyRegistryStore().clearCache()
  const reopened = scoped(() => usePackUpdateStatuses(packs))
  await vi.waitFor(() => expect(reopened.result.isLoading.value).toBe(false))
  expect(getVersions).toHaveBeenCalledTimes(3)
})
