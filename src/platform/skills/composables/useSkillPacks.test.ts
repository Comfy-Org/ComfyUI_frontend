import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/vue'
import { defineComponent } from 'vue'
import { createI18n } from 'vue-i18n'

import { reportError } from '@comfyorg/telemetry/reportError'

import {
  deleteSkillPack,
  listSkillPacks,
  SkillPacksApiError
} from '@/platform/skills/api/skillsApi'
import type { SkillPack } from '@/platform/skills/types'
import { useSkillPacks } from './useSkillPacks'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/skills/api/skillsApi'), { spy: true })

vi.mock(import('@comfyorg/telemetry/reportError'), () => ({
  reportError: vi.fn()
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  missingWarn: false,
  fallbackWarn: false,
  messages: { en: { g: { error: 'error', unknownError: 'unknown-error' } } }
})

const pack = {
  id: 'pack-1',
  name: 'my-pack',
  description: 'load me',
  body: 'do the thing',
  body_hash: 'abc',
  created_at: '2026-08-22T00:00:00Z',
  updated_at: '2026-08-22T00:00:00Z'
} satisfies SkillPack

function mountSkillPacks() {
  let api!: ReturnType<typeof useSkillPacks>
  render(
    defineComponent({
      setup() {
        api = useSkillPacks()
        return () => null
      }
    }),
    { global: { plugins: [i18n] } }
  )
  return api
}

describe('useSkillPacks', () => {
  it('reports a delete cut off by an ended session to Datadog only', async () => {
    const denied = new SkillPacksApiError('invalid session cookie', 401)
    vi.mocked(deleteSkillPack).mockRejectedValueOnce(denied)

    await expect(mountSkillPacks().deleteSkillPack(pack)).resolves.toBe(false)

    expect(reportError).toHaveBeenCalledWith(denied, {
      errorType: 'error_deleting_agent_skill_pack',
      surface: 'agent',
      sentryMode: 'never'
    })
  })

  it('reports a relisting cut off by an ended session to Datadog only', async () => {
    const denied = new SkillPacksApiError('invalid session cookie', 401)
    vi.mocked(deleteSkillPack).mockRejectedValueOnce(
      new SkillPacksApiError('not found', 404)
    )
    vi.mocked(listSkillPacks).mockRejectedValueOnce(denied)

    await expect(mountSkillPacks().deleteSkillPack(pack)).resolves.toBe(false)

    expect(reportError).toHaveBeenCalledWith(denied, {
      errorType: 'error_fetching_agent_skill_packs',
      surface: 'agent',
      sentryMode: 'never'
    })
  })

  it('keeps other delete failures on the default reporting', async () => {
    const failure = new SkillPacksApiError('boom', 500)
    vi.mocked(deleteSkillPack).mockRejectedValueOnce(failure)

    await mountSkillPacks().deleteSkillPack(pack)

    expect(reportError).toHaveBeenCalledWith(failure, {
      errorType: 'error_deleting_agent_skill_pack',
      surface: 'agent'
    })
  })
})
