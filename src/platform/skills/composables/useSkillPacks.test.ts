import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SkillPacksApiError } from '@/platform/skills/api/skillsApi'
import type { SkillPack } from '@/platform/skills/types'

import { useSkillPacks } from './useSkillPacks'

const mocks = vi.hoisted(() => ({
  deleteSkillPack: vi.fn(),
  reportError: vi.fn(),
  toastError: vi.fn(),
  store: {
    scope: 'scope-a',
    isCurrentScope: vi.fn(() => true),
    removePack: vi.fn(),
    fetchPacks: vi.fn()
  }
}))

vi.mock<unknown>(import('vue-i18n'), () => ({
  useI18n: () => ({ t: (key: string) => key })
}))
vi.mock<unknown>(import('@/components/ui/toast/toastStore'), () => ({
  useToast: () => ({ error: mocks.toastError })
}))
vi.mock(import('@comfyorg/telemetry/reportError'), () => ({
  reportError: mocks.reportError
}))
vi.mock(import('@/platform/skills/api/skillsApi'), async (importOriginal) => ({
  ...(await importOriginal()),
  deleteSkillPack: mocks.deleteSkillPack
}))
vi.mock<unknown>(import('@/platform/skills/stores/skillPacksStore'), () => ({
  useSkillPacksStore: () => mocks.store
}))

const pack = { name: 'my-pack' } as SkillPack

describe('useSkillPacks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reports a delete cut off by an ended session to Datadog only', async () => {
    const denied = new SkillPacksApiError('invalid session cookie', 401)
    mocks.deleteSkillPack.mockRejectedValue(denied)

    await expect(useSkillPacks().deleteSkillPack(pack)).resolves.toBe(false)

    expect(mocks.reportError).toHaveBeenCalledWith(denied, {
      errorType: 'error_deleting_agent_skill_pack',
      surface: 'agent',
      sentryMode: 'never'
    })
  })

  it('reports a relisting cut off by an ended session to Datadog only', async () => {
    const denied = new SkillPacksApiError('invalid session cookie', 401)
    mocks.deleteSkillPack.mockRejectedValue(
      new SkillPacksApiError('not found', 404)
    )
    mocks.store.fetchPacks.mockRejectedValue(denied)

    await expect(useSkillPacks().deleteSkillPack(pack)).resolves.toBe(false)

    expect(mocks.reportError).toHaveBeenCalledWith(denied, {
      errorType: 'error_fetching_agent_skill_packs',
      surface: 'agent',
      sentryMode: 'never'
    })
  })

  it('keeps other delete failures on the default reporting', async () => {
    const failure = new SkillPacksApiError('boom', 500)
    mocks.deleteSkillPack.mockRejectedValue(failure)

    await useSkillPacks().deleteSkillPack(pack)

    expect(mocks.reportError).toHaveBeenCalledWith(failure, {
      errorType: 'error_deleting_agent_skill_pack',
      surface: 'agent'
    })
  })
})
