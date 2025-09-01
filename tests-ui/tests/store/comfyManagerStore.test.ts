import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'

import { useComfyManagerService } from '@/services/comfyManagerService'
import { useComfyManagerStore } from '@/stores/comfyManagerStore'
import {
  InstalledPacksResponse,
  ManagerPackInstalled
} from '@/types/comfyManagerTypes'

vi.mock('@/services/comfyManagerService', () => ({
  useComfyManagerService: vi.fn()
}))

vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: vi.fn((key) => key)
  }),
  createI18n: vi.fn(() => ({
    global: {
      t: vi.fn((key) => key)
    }
  }))
}))

interface EnabledDisabledTestCase {
  desc: string
  installed: Record<string, ManagerPackInstalled>
  expectState: 'enabled' | 'disabled'
  /** @default 'name' */
  packName?: string
}

describe('useComfyManagerStore', () => {
  let mockManagerService: {
    isLoading: ReturnType<typeof ref<boolean>>
    error: ReturnType<typeof ref<string | null>>
    listInstalledPacks: ReturnType<typeof vi.fn>
  }

  const triggerPacksChange = async (
    installedPacks: InstalledPacksResponse,
    store: ReturnType<typeof useComfyManagerStore>
  ) => {
    // Simulate change in value to properly trigger watchers. Required even for immediate watchers.
    store.installedPacks = {}
    await nextTick()
    store.installedPacks = installedPacks
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    mockManagerService = {
      isLoading: ref(false),
      error: ref(null),
      listInstalledPacks: vi.fn().mockResolvedValue({})
    }

    // @ts-expect-error Mocking the return type of useComfyManagerService
    vi.mocked(useComfyManagerService).mockReturnValue(mockManagerService)
  })

  const testCases: EnabledDisabledTestCase[] = [
    {
      desc: 'Two enabled versions',
      installed: {
        'name@1_0_2': {
          enabled: true,
          cnr_id: 'name',
          ver: '1.0.2',
          aux_id: undefined
        },
        name: { enabled: true, cnr_id: 'name', ver: '1.0.0', aux_id: undefined }
      },
      expectState: 'enabled'
    },
    {
      desc: 'Two disabled versions',
      installed: {
        'name@1_0_2': {
          enabled: false,
          cnr_id: 'name',
          ver: '1.0.2',
          aux_id: undefined
        },
        name: {
          enabled: false,
          cnr_id: 'name',
          ver: '1.0.0',
          aux_id: undefined
        }
      },
      expectState: 'disabled'
    },
    {
      desc: 'Enabled version and pinned disabled version',
      installed: {
        'name@1_0_2': {
          enabled: false,
          cnr_id: 'name',
          ver: '1.0.2',
          aux_id: undefined
        },
        name: { enabled: true, cnr_id: 'name', ver: '1.0.0', aux_id: undefined }
      },
      expectState: 'enabled'
    },
    {
      desc: 'Disabled version and pinned enabled version',
      installed: {
        'name@1_0_2': {
          enabled: true,
          cnr_id: 'name',
          ver: '1.0.2',
          aux_id: undefined
        },
        name: {
          enabled: false,
          cnr_id: 'name',
          ver: '1.0.0',
          aux_id: undefined
        }
      },
      expectState: 'enabled'
    },
    {
      desc: 'Pinned enabled version, Pinned disabled version',
      installed: {
        'name@1_0_2': {
          enabled: false,
          cnr_id: 'name',
          ver: '1.0.2',
          aux_id: undefined
        },
        'name@1_0_3': {
          enabled: true,
          cnr_id: 'name',
          ver: '1.0.3',
          aux_id: undefined
        }
      },
      expectState: 'enabled'
    },
    {
      desc: 'Two enabled non-CNR versions',
      packName: 'author/name',
      installed: {
        'author/name@1_0_2': {
          enabled: true,
          aux_id: 'author/name',
          cnr_id: undefined,
          ver: '1.0.2'
        },
        'author/name': {
          enabled: true,
          aux_id: 'author/name',
          cnr_id: undefined,
          ver: '1.0.0'
        }
      },
      expectState: 'enabled'
    },
    {
      desc: 'Two disabled non-CNR versions',
      packName: 'author/name',
      installed: {
        'author/name@1_0_2': {
          enabled: false,
          aux_id: 'author/name',
          cnr_id: undefined,
          ver: '1.0.2'
        },
        'author/name': {
          enabled: false,
          aux_id: 'author/name',
          cnr_id: undefined,
          ver: '1.0.0'
        }
      },
      expectState: 'disabled'
    },
    {
      desc: 'Non-CNR disabled version, CNR enabled version',
      packName: 'author/name',
      installed: {
        'author/name': {
          enabled: false,
          aux_id: 'author/name',
          cnr_id: undefined,
          ver: '1.0.0'
        },
        'author/name@1_0_2': {
          enabled: true,
          cnr_id: 'author/name',
          ver: '1.0.2',
          aux_id: undefined
        }
      },
      expectState: 'enabled'
    },
    {
      desc: 'Disabled non-CNR version, CNR disabled version',
      packName: 'author/name',
      installed: {
        'author/name': {
          enabled: false,
          aux_id: 'author/name',
          cnr_id: undefined, // non-CNR pack
          ver: '1.0.0'
        },
        'author/name@1_0_2': {
          enabled: false,
          cnr_id: 'author/name', // CNR pack
          ver: '1.0.2',
          aux_id: undefined
        }
      },
      expectState: 'disabled'
    },
    {
      desc: 'Enabled non-CNR version, two versions',
      packName: 'author/name',
      installed: {
        'author/name': {
          enabled: true,
          aux_id: 'author/name',
          cnr_id: undefined,
          ver: '1.0.0'
        },
        'author/name@1_0_2': {
          enabled: true,
          cnr_id: 'author/name',
          ver: '1.0.2',
          aux_id: undefined
        }
      },
      expectState: 'enabled'
    },
    {
      desc: 'Enabled CNR version',
      packName: 'name',
      installed: {
        name: { enabled: true, cnr_id: 'name', ver: '1.0.0', aux_id: undefined }
      },
      expectState: 'enabled'
    },
    {
      desc: 'Disabled CNR version',
      packName: 'name',
      installed: {
        name: {
          enabled: false,
          cnr_id: 'name',
          ver: '1.0.0',
          aux_id: undefined
        }
      },
      expectState: 'disabled'
    },
    {
      desc: 'Enabled non-CNR version',
      packName: 'author/name',
      installed: {
        'author/name': {
          enabled: true,
          aux_id: 'author/name',
          cnr_id: undefined,
          ver: '1.0.0'
        }
      },
      expectState: 'enabled'
    },
    {
      desc: 'Disabled non-CNR version',
      packName: 'author/name',
      installed: {
        'author/name': {
          enabled: false,
          aux_id: 'author/name',
          cnr_id: undefined,
          ver: '1.0.0'
        }
      },
      expectState: 'disabled'
    },
    {
      desc: 'Pack not installed',
      installed: {
        'a different pack': {
          enabled: true,
          cnr_id: 'a different pack',
          ver: '1.0.0',
          aux_id: undefined
        }
      },
      expectState: 'disabled'
    }
  ]

  describe('isPackEnabled', () => {
    it.each(testCases)(
      '$expectState when $desc',
      async ({ installed, expectState, packName }) => {
        packName ??= 'name'

        const store = useComfyManagerStore()
        await triggerPacksChange(installed, store)

        const enabled = expectState === 'enabled'
        expect(store.isPackEnabled(packName)).toBe(enabled)
      }
    )
  })
})
