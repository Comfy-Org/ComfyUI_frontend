import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import { listSkillPacks } from '@/platform/skills/api/skillsApi'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { SkillPack } from '@/platform/skills/types'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import Composer from './Composer.vue'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'

setupInlinePromptEditorDom()
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/skills/api/skillsApi'), { spy: true })
vi.mock(import('@/platform/telemetry/reportError'))

function pack(name: string, description: string): SkillPack {
  return {
    id: name,
    name,
    description,
    body: 'Private instructions never needed by the picker',
    body_hash: 'hash',
    created_at: '2026-10-06T00:00:00Z',
    updated_at: '2026-10-06T00:00:00Z'
  }
}

const catalog = [
  pack('portrait', 'Compose a portrait'),
  pack('utils', 'Shared helpers')
]

function mount() {
  const skills = useSkillPacksStore()
  skills.flagsEnabled = true
  skills.hasLoaded = true
  skills.catalogConfirmed = true
  skills.packs = catalog
  vi.spyOn(skills, 'startFlagGate').mockResolvedValue()
  render(Composer, {
    props: { hasWorkflowTarget: true },
    global: { plugins: [i18n], directives: { tooltip: () => {} } }
  })
  return { composer: useAgentComposerStore() }
}

async function typeThenPaste(typed: string, pasted: string) {
  await userEvent.click(screen.getByRole('textbox'))
  if (typed) await userEvent.keyboard(typed)
  await userEvent.paste(pasted)
}

describe('Composer plain skill paste', () => {
  beforeEach(() => {
    vi.mocked(listSkillPacks).mockResolvedValue(catalog)
  })

  it.for([
    ['src', '/utils'],
    ['src', '/portrait next']
  ])(
    'keeps a paste literal right after a non-space character: "%s" + "%s"',
    async ([typed, pasted]) => {
      const { composer } = mount()
      await typeThenPaste(typed, pasted)
      expect(composer.prompt).toEqual({
        text: `${typed}${pasted}`,
        references: []
      })
      expect(screen.queryByTestId('skill-reference')).toBeNull()
    }
  )

  it.for([
    ['', ' next'],
    ['Before ', 'Before  next'],
    ['Before\t', 'Before\t next']
  ])(
    'creates a skill when pasted at the start or after whitespace: "%s"',
    async ([typed, text]) => {
      const { composer } = mount()
      await typeThenPaste(typed, '/portrait next')
      expect(screen.getByTestId('skill-reference')).toHaveTextContent(
        '/portrait'
      )
      expect(composer.prompt).toEqual({
        text,
        references: [
          expect.objectContaining({
            kind: 'skill',
            name: 'portrait',
            textOffset: typed.length
          })
        ]
      })
    }
  )
})
