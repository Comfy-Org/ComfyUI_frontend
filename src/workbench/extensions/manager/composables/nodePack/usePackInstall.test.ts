import { createTestingPinia } from '@pinia/testing'
import { setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { components } from '@/types/comfyRegistryTypes'
import { usePackInstall } from '@/workbench/extensions/manager/composables/nodePack/usePackInstall'

type NodePack = components['schemas']['Node']

const toastAdd = vi.fn()
const installPackCall = vi.fn()
const installPackClear = vi.fn()
const isPackInstalled = vi.fn(() => false)

vi.mock('@/platform/updates/common/toastStore', () => ({
  useToastStore: vi.fn(() => ({
    add: toastAdd
  }))
}))

vi.mock('@/workbench/extensions/manager/stores/comfyManagerStore', () => ({
  useComfyManagerStore: vi.fn(() => ({
    installPack: {
      call: installPackCall,
      clear: installPackClear
    },
    isPackInstalled,
    isPackInstalling: vi.fn(() => false)
  }))
}))

vi.mock(
  '@/workbench/extensions/manager/composables/useNodeConflictDialog',
  () => ({
    useNodeConflictDialog: vi.fn(() => ({
      show: vi.fn()
    }))
  })
)

vi.mock(
  '@/workbench/extensions/manager/composables/useConflictDetection',
  () => ({
    useConflictDetection: vi.fn(() => ({
      checkNodeCompatibility: vi.fn(() => ({
        hasConflict: false,
        conflicts: []
      }))
    }))
  })
)

vi.mock('vue-i18n', () => ({
  useI18n: vi.fn(() => ({
    t: (key: string, ...args: unknown[]) => {
      const named = args.find(
        (a): a is Record<string, unknown> =>
          typeof a === 'object' && a !== null && !Array.isArray(a)
      )
      if (named && 'count' in named) {
        return `${key}:${String(named.count)}`
      }
      return key
    }
  }))
}))

const createMockPack = (id: string): NodePack =>
  ({
    id,
    name: `Pack ${id}`,
    repository: 'https://github.com/test/pack',
    publisher: { name: 'TestPublisher' },
    latest_version: { version: '1.0.0' }
  }) as unknown as NodePack

describe('usePackInstall', () => {
  beforeEach(() => {
    setActivePinia(createTestingPinia({ stubActions: false }))
    toastAdd.mockClear()
    installPackCall.mockReset()
    installPackClear.mockClear()
    isPackInstalled.mockReturnValue(false)
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not show a toast when all installations succeed', async () => {
    installPackCall.mockResolvedValue(undefined)
    const packs = [createMockPack('a'), createMockPack('b')]
    const { performInstallation } = usePackInstall(() => packs)

    await performInstallation(packs)

    expect(toastAdd).not.toHaveBeenCalled()
    expect(installPackClear).toHaveBeenCalledTimes(1)
  })

  it('shows a single error toast summarising failures when installations fail', async () => {
    installPackCall
      .mockRejectedValueOnce(new Error('boom-a'))
      .mockRejectedValueOnce(new Error('boom-b'))
    const packs = [createMockPack('a'), createMockPack('b')]
    const { performInstallation } = usePackInstall(() => packs)

    await performInstallation(packs)

    expect(toastAdd).toHaveBeenCalledTimes(1)
    const message = toastAdd.mock.calls[0][0]
    expect(message.severity).toBe('error')
    expect(message.summary).toBe('manager.installFailureToast.summary')
    expect(message.detail).toBe('manager.installFailureToast.detail:2')
  })

  it('shows the toast even when only one of many installs fails', async () => {
    installPackCall
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined)
    const packs = [
      createMockPack('a'),
      createMockPack('b'),
      createMockPack('c')
    ]
    const { performInstallation } = usePackInstall(() => packs)

    await performInstallation(packs)

    expect(toastAdd).toHaveBeenCalledTimes(1)
    const message = toastAdd.mock.calls[0][0]
    expect(message.detail).toBe('manager.installFailureToast.detail:1')
  })

  it('always clears the install cache, even on failure', async () => {
    installPackCall.mockRejectedValue(new Error('boom'))
    const packs = [createMockPack('a')]
    const { performInstallation } = usePackInstall(() => packs)

    await performInstallation(packs)

    expect(installPackClear).toHaveBeenCalledTimes(1)
  })
})
