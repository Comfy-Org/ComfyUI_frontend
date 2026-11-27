import {
  getDefaultNormalizer,
  render,
  screen,
  within
} from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import {
  listBuiltinSkills,
  listSkillPacks
} from '@/platform/skills/api/skillsApi'
import { useBuiltinSkillsStore } from '@/platform/skills/stores/builtinSkillsStore'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { BuiltinSkill, SkillPack } from '@/platform/skills/types'
import Composer from '@/workbench/extensions/agent/components/agent/Composer.vue'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { setupInlinePromptEditorDom } from './inlinePromptEditorTestSetup'

setupInlinePromptEditorDom()
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/skills/api/skillsApi'), { spy: true })

const COMFY_BATCH_DESC =
  'Load this skill when running a batch of image prompts across variations.'
const COMFY_PRODUCT_DESC =
  'Load this skill when producing a commercial product ad.'

function pack(name: string, description: string): SkillPack {
  return {
    id: name,
    name,
    description,
    body: 'User instructions',
    body_hash: 'hash',
    created_at: '2026-10-06T00:00:00Z',
    updated_at: '2026-10-06T00:00:00Z'
  }
}

function builtin(name: string, description: string): BuiltinSkill {
  return { name, description }
}

function mountComposer({
  userPacks = [
    pack('portrait', 'Compose a portrait'),
    pack('profile-shot', 'Frame a profile shot')
  ],
  comfySkills = [
    builtin('batch-generation', COMFY_BATCH_DESC),
    builtin('product-ad', COMFY_PRODUCT_DESC)
  ]
}: {
  userPacks?: SkillPack[]
  comfySkills?: BuiltinSkill[]
} = {}) {
  const skills = useSkillPacksStore()
  skills.flagsEnabled = true
  skills.hasLoaded = true
  skills.catalogConfirmed = true
  skills.packs = userPacks
  vi.spyOn(skills, 'startFlagGate').mockResolvedValue()

  const builtinStore = useBuiltinSkillsStore()
  builtinStore.hasLoaded = true
  builtinStore.catalogConfirmed = true
  builtinStore.skills = comfySkills

  const rendered = render(Composer, {
    props: { hasWorkflowTarget: true },
    global: { plugins: [i18n] }
  })
  return {
    ...rendered,
    skills,
    builtinStore,
    composer: useAgentComposerStore()
  }
}

async function typeInComposer(text: string, user = userEvent.setup()) {
  await user.click(screen.getByRole('textbox'))
  await user.keyboard(text)
  return user
}

describe('Composer slash skill picker groups', () => {
  beforeEach(() => {
    vi.mocked(listSkillPacks).mockResolvedValue([
      pack('portrait', 'Compose a portrait'),
      pack('profile-shot', 'Frame a profile shot')
    ])
    vi.mocked(listBuiltinSkills).mockResolvedValue({
      status: 'ok',
      skills: [
        builtin('batch-generation', COMFY_BATCH_DESC),
        builtin('product-ad', COMFY_PRODUCT_DESC)
      ]
    })
  })

  it('shows Your skills and Comfy skills groups on bare slash with no row highlighted and ArrowDown skipping headers', async () => {
    mountComposer()
    await typeInComposer('/')

    const menu = screen.getByRole('menu', { name: 'Skills' })
    const userGroup = within(menu).getByRole('group', { name: 'Your skills' })
    const comfyGroup = within(menu).getByRole('group', { name: 'Comfy skills' })
    expect(within(menu).getByRole('separator')).toBeVisible()
    expect(within(userGroup).getAllByRole('menuitem')).toHaveLength(2)
    expect(within(comfyGroup).getAllByRole('menuitem')).toHaveLength(2)

    const allItems = within(menu).getAllByRole('menuitem')
    expect(allItems.map((item) => item.getAttribute('data-active'))).toEqual([
      'false',
      'false',
      'false',
      'false'
    ])
    expect(screen.getByRole('textbox')).not.toHaveAttribute(
      'aria-activedescendant'
    )

    await userEvent.keyboard('{ArrowDown}')
    expect(
      within(userGroup).getByRole('menuitem', { name: 'portrait' })
    ).toHaveAttribute('data-active', 'true')

    await userEvent.keyboard('{ArrowDown}{ArrowDown}')
    expect(
      within(comfyGroup).getByRole('menuitem', { name: 'batch-generation' })
    ).toHaveAttribute('data-active', 'true')
  })

  it.for([
    {
      query: 'pro',
      expectedGroups: ['Your skills', 'Comfy skills'],
      absentGroups: [],
      separators: 1,
      firstActive: 'profile-shot'
    },
    {
      query: 'por',
      expectedGroups: ['Your skills'],
      absentGroups: ['Comfy skills'],
      separators: 0,
      firstActive: 'portrait'
    },
    {
      query: 'bat',
      expectedGroups: ['Comfy skills'],
      absentGroups: ['Your skills'],
      separators: 0,
      firstActive: 'batch-generation'
    }
  ])(
    'shows headers only for matching groups when typing /$query and highlights $firstActive',
    async ({
      query,
      expectedGroups,
      absentGroups,
      separators,
      firstActive
    }) => {
      mountComposer()
      await typeInComposer(`/${query}`)

      const menu = screen.getByRole('menu', { name: 'Skills' })
      expect(
        within(menu)
          .getAllByRole('group')
          .map((group) => group.getAttribute('aria-labelledby'))
      ).toHaveLength(expectedGroups.length)
      expect(within(menu).queryAllByRole('separator')).toHaveLength(separators)
      expect(
        within(menu).getByRole('menuitem', { name: firstActive })
      ).toHaveAttribute('data-active', 'true')
      expect(
        expectedGroups.map((name) =>
          Boolean(within(menu).getByRole('group', { name }))
        )
      ).toEqual(expectedGroups.map(() => true))
      expect(
        absentGroups.map((name) => within(menu).queryByRole('group', { name }))
      ).toEqual(absentGroups.map(() => null))
    }
  )

  it('picks a Comfy skill from the slash picker as the same reference and replaces an earlier skill in one undo step', async () => {
    const { composer, emitted } = mountComposer()
    await typeInComposer('/por')
    await userEvent.keyboard('{Enter}')
    expect(composer.prompt.references).toMatchObject([{ name: 'portrait' }])

    await userEvent.keyboard(' /bat')
    await userEvent.keyboard('{Enter}')

    expect(composer.prompt.references).toEqual([
      expect.objectContaining({
        kind: 'skill',
        name: 'batch-generation',
        description: COMFY_BATCH_DESC
      })
    ])
    expect(screen.queryByRole('menu', { name: 'Skills' })).toBeNull()
    expect(emitted().send).toBeUndefined()

    await userEvent.keyboard('{Control>}z{/Control}')
    expect(composer.prompt.references).toMatchObject([{ name: 'portrait' }])
  })

  it('shows the Comfy skill full description card when highlighted in the slash picker while keeping the row name-only', async () => {
    vi.useFakeTimers()
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    mountComposer()
    await typeInComposer('/bat', user)
    const row = screen.getByRole('menuitem', { name: 'batch-generation' })
    expect(row).toHaveTextContent(/^batch-generation$/)

    await vi.advanceTimersByTimeAsync(300)
    expect(
      screen.getByText(COMFY_BATCH_DESC, {
        normalizer: getDefaultNormalizer({ collapseWhitespace: false })
      })
    ).toBeVisible()
  })

  it('omits Your skills header and separator on bare slash when the user has no skills', async () => {
    vi.mocked(listSkillPacks).mockResolvedValue([])
    mountComposer({ userPacks: [] })
    await typeInComposer('/')

    const menu = screen.getByRole('menu', { name: 'Skills' })
    expect(
      within(menu).queryByRole('group', { name: 'Your skills' })
    ).toBeNull()
    expect(
      within(menu).getByRole('group', { name: 'Comfy skills' })
    ).toBeVisible()
    expect(within(menu).queryByRole('separator')).toBeNull()
  })

  it('hides a shadowed Comfy skill in the slash picker and keeps it under Your skills only', async () => {
    vi.mocked(listSkillPacks).mockResolvedValue([
      pack('product-ad', 'User product ad')
    ])
    mountComposer({
      userPacks: [pack('product-ad', 'User product ad')]
    })
    await typeInComposer('/pro')

    const menu = screen.getByRole('menu', { name: 'Skills' })
    const userGroup = within(menu).getByRole('group', { name: 'Your skills' })
    expect(
      within(userGroup).getByRole('menuitem', { name: 'product-ad' })
    ).toBeVisible()
    expect(
      within(menu).queryByRole('group', { name: 'Comfy skills' })
    ).toBeNull()
    expect(
      within(menu).getAllByRole('menuitem', { name: 'product-ad' })
    ).toHaveLength(1)
  })

  it('keeps the flat slash picker without group headers when no Comfy skills are present', async () => {
    vi.mocked(listBuiltinSkills).mockResolvedValue({
      status: 'ok',
      skills: []
    })
    mountComposer({ comfySkills: [] })
    await typeInComposer('/')

    const menu = screen.getByRole('menu', { name: 'Skills' })
    expect(within(menu).getByText('Skills')).toBeVisible()
    expect(within(menu).queryByRole('group')).toBeNull()
    expect(within(menu).queryByRole('separator')).toBeNull()
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(2)
  })
})
