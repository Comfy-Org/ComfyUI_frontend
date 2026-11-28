import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import {
  listBuiltinSkills,
  listSkillPacks,
  SkillPacksApiError
} from '@/platform/skills/api/skillsApi'
import { useBuiltinSkillsStore } from '@/platform/skills/stores/builtinSkillsStore'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { BuiltinSkill, SkillPack } from '@/platform/skills/types'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import Composer from '@/workbench/extensions/agent/components/agent/Composer.vue'
import { setupInlinePromptEditorDom } from './inlinePromptEditorTestSetup'

setupInlinePromptEditorDom()
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/skills/api/skillsApi'), { spy: true })

const COMFY_BATCH_DESC =
  'Load this skill whenever the user asks to run a batch of images across multiple prompts or parameter variations.'
const COMFY_PRODUCT_DESC =
  'Load this skill when producing a commercial product ad with lighting, staging, and shot direction.'

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
  userPacks = [pack('portrait', 'Compose a portrait')],
  comfySkills = [
    builtin('batch-generation', COMFY_BATCH_DESC),
    builtin('product-ad', COMFY_PRODUCT_DESC)
  ],
  skillsEnabled = true
}: {
  userPacks?: SkillPack[]
  comfySkills?: BuiltinSkill[]
  skillsEnabled?: boolean
} = {}) {
  const skills = useSkillPacksStore()
  skills.flagsEnabled = skillsEnabled
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

async function openSkillsSubmenu() {
  await userEvent.click(screen.getByRole('button', { name: 'Add to prompt' }))
  await userEvent.click(await screen.findByRole('menuitem', { name: 'Skills' }))
}

describe('Composer skills submenu groups', () => {
  beforeEach(() => {
    vi.mocked(listSkillPacks).mockResolvedValue([
      pack('portrait', 'Compose a portrait')
    ])
    vi.mocked(listBuiltinSkills).mockResolvedValue({
      status: 'ok',
      skills: [
        builtin('batch-generation', COMFY_BATCH_DESC),
        builtin('product-ad', COMFY_PRODUCT_DESC)
      ]
    })
  })

  it('renders Your skills and Comfy skills groups, name-only Comfy rows with hover description, dividers, and sticky Manage skills', async () => {
    const { emitted } = mountComposer()
    await openSkillsSubmenu()

    const userGroup = await screen.findByRole('group', { name: 'Your skills' })
    const comfyGroup = screen.getByRole('group', { name: 'Comfy skills' })

    const userRow = within(userGroup).getByRole('menuitem', {
      name: 'portrait'
    })
    expect(userRow).toHaveTextContent('Compose a portrait')

    const comfyRow = within(comfyGroup).getByRole('menuitem', {
      name: 'batch-generation'
    })
    expect(comfyRow).toHaveTextContent(/^batch-generation$/)
    expect(comfyRow).toHaveAccessibleDescription(COMFY_BATCH_DESC)

    await userEvent.hover(comfyRow)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      COMFY_BATCH_DESC
    )

    expect(screen.getAllByRole('separator')).toHaveLength(2)

    const footer = screen.getByTestId('skills-submenu-footer')
    expect(footer).toHaveClass('sticky')
    const manage = within(footer).getByRole('menuitem', {
      name: 'Manage skills'
    })
    await userEvent.click(manage)
    expect(emitted().manageSkills).toEqual([[]])
  })

  it('moves keyboard focus across groups, skips labels, reveals Comfy description on focus, and reaches Manage skills', async () => {
    mountComposer()
    await openSkillsSubmenu()
    await screen.findByRole('group', { name: 'Comfy skills' })

    const back = screen.getByRole('menuitem', { name: 'Back' })
    back.focus()
    expect(back).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'portrait' })).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    const batchRow = screen.getByRole('menuitem', { name: 'batch-generation' })
    expect(batchRow).toHaveFocus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      COMFY_BATCH_DESC
    )

    await userEvent.keyboard('{ArrowDown}')
    expect(screen.getByRole('menuitem', { name: 'product-ad' })).toHaveFocus()

    await userEvent.keyboard('{ArrowDown}')
    expect(
      screen.getByRole('menuitem', { name: 'Manage skills' })
    ).toHaveFocus()
  })

  it('inserts a Comfy skill reference and replaces an earlier skill in one undo step', async () => {
    const { composer, emitted } = mountComposer()
    await openSkillsSubmenu()
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'portrait' })
    )
    expect(composer.prompt.references).toMatchObject([{ name: 'portrait' }])
    expect(emitted().send).toBeUndefined()

    await openSkillsSubmenu()
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'batch-generation' })
    )
    expect(composer.prompt.references).toEqual([
      expect.objectContaining({
        kind: 'skill',
        name: 'batch-generation',
        description: COMFY_BATCH_DESC
      })
    ])
    expect(emitted().send).toBeUndefined()

    await userEvent.keyboard('{Control>}z{/Control}')
    expect(composer.prompt.references).toMatchObject([{ name: 'portrait' }])
  })

  it('shows Your skills empty status while Comfy skills remain pickable', async () => {
    vi.mocked(listSkillPacks).mockResolvedValue([])
    const { composer } = mountComposer({ userPacks: [] })
    await openSkillsSubmenu()

    const userGroup = await screen.findByRole('group', { name: 'Your skills' })
    expect(within(userGroup).getByRole('status')).toHaveTextContent(
      'No skills yet'
    )

    const comfyGroup = screen.getByRole('group', { name: 'Comfy skills' })
    await userEvent.click(
      within(comfyGroup).getByRole('menuitem', { name: 'batch-generation' })
    )
    expect(composer.prompt.references).toMatchObject([
      { name: 'batch-generation' }
    ])
  })

  it('shows loading status under Your skills while Comfy skills are loaded', async () => {
    vi.mocked(listSkillPacks).mockReturnValue(new Promise(() => {}))
    const { skills } = mountComposer({ userPacks: [] })
    skills.hasLoaded = false
    skills.catalogConfirmed = false
    skills.loading = true

    await openSkillsSubmenu()

    const userGroup = await screen.findByRole('group', { name: 'Your skills' })
    expect(within(userGroup).getByRole('status')).toHaveTextContent(
      'Loading skills…'
    )
    expect(
      within(screen.getByRole('group', { name: 'Comfy skills' })).getByRole(
        'menuitem',
        { name: 'batch-generation' }
      )
    ).toBeVisible()
  })

  it('shows failed status and isolated Retry under Your skills while Comfy skills remain available', async () => {
    vi.mocked(listSkillPacks).mockRejectedValueOnce(
      new SkillPacksApiError('server error', 500)
    )
    const { skills } = mountComposer({ userPacks: [] })
    skills.hasLoaded = false
    skills.catalogConfirmed = false
    skills.loadFailed = true

    await openSkillsSubmenu()

    const userGroup = await screen.findByRole('group', { name: 'Your skills' })
    expect(within(userGroup).getByRole('status')).toHaveTextContent(
      'Could not load skills. Try again.'
    )
    const comfyCallsBefore = vi.mocked(listBuiltinSkills).mock.calls.length
    vi.mocked(listSkillPacks).mockResolvedValueOnce([
      pack('recovered', 'Recovered skill')
    ])

    await userEvent.click(
      within(userGroup).getByRole('menuitem', { name: 'Retry' })
    )

    expect(
      await within(userGroup).findByRole('menuitem', { name: 'recovered' })
    ).toBeVisible()
    expect(listBuiltinSkills).toHaveBeenCalledTimes(comfyCallsBefore)
  })

  it('shows Comfy skills loading without blocking user rows', async () => {
    vi.mocked(listBuiltinSkills).mockReturnValue(new Promise(() => {}))
    const { builtinStore } = mountComposer({ comfySkills: [] })
    builtinStore.hasLoaded = false
    builtinStore.catalogConfirmed = false
    builtinStore.loading = true
    builtinStore.catalogRequested = true

    await openSkillsSubmenu()

    expect(
      await within(
        await screen.findByRole('group', { name: 'Your skills' })
      ).findByRole('menuitem', { name: 'portrait' })
    ).toBeVisible()
    expect(
      within(screen.getByRole('group', { name: 'Comfy skills' })).getByRole(
        'status'
      )
    ).toHaveTextContent('Loading Comfy skills…')
  })

  it('shows failed status under Comfy skills and retries only Comfy skills without reloading user packs', async () => {
    const { builtinStore } = mountComposer({ comfySkills: [] })
    builtinStore.hasLoaded = false
    builtinStore.catalogConfirmed = false
    builtinStore.loadFailed = true
    builtinStore.catalogRequested = true

    await openSkillsSubmenu()

    const comfyGroup = await screen.findByRole('group', {
      name: 'Comfy skills'
    })
    expect(within(comfyGroup).getByRole('status')).toHaveTextContent(
      'Could not load Comfy skills. Try again.'
    )
    expect(
      within(screen.getByRole('group', { name: 'Your skills' })).getByRole(
        'menuitem',
        { name: 'portrait' }
      )
    ).toBeVisible()

    const userCallsBefore = vi.mocked(listSkillPacks).mock.calls.length
    vi.mocked(listBuiltinSkills).mockResolvedValueOnce({
      status: 'ok',
      skills: [builtin('batch-generation', COMFY_BATCH_DESC)]
    })

    await userEvent.click(
      within(comfyGroup).getByRole('menuitem', { name: 'Retry' })
    )

    expect(
      await within(comfyGroup).findByRole('menuitem', {
        name: 'batch-generation'
      })
    ).toBeVisible()
    expect(listSkillPacks).toHaveBeenCalledTimes(userCallsBefore)
  })

  it.for([
    {
      when: 'the built-in route returns 404',
      setup: async () => {
        vi.mocked(listBuiltinSkills).mockResolvedValueOnce({
          status: 'unavailable'
        })
        const mounted = mountComposer({ comfySkills: [] })
        mounted.builtinStore.hasLoaded = false
        mounted.builtinStore.catalogConfirmed = false
        await mounted.builtinStore.ensureSkills()
        return mounted
      }
    },
    {
      when: 'the built-in catalog is confirmed empty',
      setup: async () => {
        vi.mocked(listBuiltinSkills).mockResolvedValue({
          status: 'ok',
          skills: []
        })
        return mountComposer({ comfySkills: [] })
      }
    }
  ])(
    'falls back to the single-group menu with one separator and no error when $when',
    async ({ setup }) => {
      await setup()
      await openSkillsSubmenu()

      expect(
        await screen.findByRole('menuitem', { name: 'portrait' })
      ).toBeVisible()
      expect(screen.queryByRole('group')).toBeNull()
      expect(screen.queryByText('Your skills')).toBeNull()
      expect(screen.queryByText('Comfy skills')).toBeNull()
      expect(screen.queryByRole('status')).toBeNull()
      expect(screen.getAllByRole('separator')).toHaveLength(1)
    }
  )

  it('hides the Skills entry when skills are disabled even if built-in skills exist', async () => {
    mountComposer({ skillsEnabled: false })
    await userEvent.click(screen.getByRole('button', { name: 'Add to prompt' }))

    expect(screen.queryByRole('menuitem', { name: 'Skills' })).toBeNull()
  })

  it('hides a Comfy skill shadowed by a user pack and restores it once the user pack is deleted', async () => {
    vi.mocked(listSkillPacks).mockResolvedValue([
      pack('product-ad', 'My own product ad')
    ])
    const { skills } = mountComposer({
      userPacks: [pack('product-ad', 'My own product ad')]
    })
    await openSkillsSubmenu()

    const userGroup = await screen.findByRole('group', { name: 'Your skills' })
    const comfyGroup = screen.getByRole('group', { name: 'Comfy skills' })
    expect(
      within(userGroup).getByRole('menuitem', { name: 'product-ad' })
    ).toBeVisible()
    expect(
      within(comfyGroup).queryByRole('menuitem', { name: 'product-ad' })
    ).toBeNull()
    expect(
      screen.getAllByRole('menuitem', { name: 'product-ad' })
    ).toHaveLength(1)

    await userEvent.keyboard('{Escape}')
    skills.removePack('product-ad')
    vi.mocked(listSkillPacks).mockResolvedValue([])
    await openSkillsSubmenu()

    const reopenedComfyGroup = await screen.findByRole('group', {
      name: 'Comfy skills'
    })
    await waitFor(() =>
      expect(
        within(reopenedComfyGroup).getByRole('menuitem', { name: 'product-ad' })
      ).toBeVisible()
    )
    expect(listBuiltinSkills).not.toHaveBeenCalled()
  })

  it('omits headers and second separator when all Comfy skills are shadowed by user packs', async () => {
    vi.mocked(listSkillPacks).mockResolvedValue([
      pack('product-ad', 'My own product ad')
    ])
    mountComposer({
      userPacks: [pack('product-ad', 'My own product ad')],
      comfySkills: [builtin('product-ad', COMFY_PRODUCT_DESC)]
    })
    await openSkillsSubmenu()

    expect(
      await screen.findByRole('menuitem', { name: 'product-ad' })
    ).toBeVisible()
    expect(screen.queryByRole('group')).toBeNull()
    expect(screen.getAllByRole('separator')).toHaveLength(1)
  })

  it('keeps user skill menu item nodes and focus intact when the built-in catalog settles empty', async () => {
    let resolveBuiltin: (result: {
      status: 'ok'
      skills: BuiltinSkill[]
    }) => void = () => {}
    vi.mocked(listBuiltinSkills).mockReturnValueOnce(
      new Promise((settle) => {
        resolveBuiltin = settle
      })
    )
    const { builtinStore } = mountComposer({ comfySkills: [] })
    builtinStore.hasLoaded = false
    builtinStore.catalogConfirmed = false
    builtinStore.catalogRequested = false

    await openSkillsSubmenu()

    const userGroup = await screen.findByRole('group', { name: 'Your skills' })
    const userRowBefore = within(userGroup).getByRole('menuitem', {
      name: 'portrait'
    })
    userRowBefore.focus()
    expect(userRowBefore).toHaveFocus()

    resolveBuiltin({ status: 'ok', skills: [] })

    await waitFor(() => expect(screen.queryByRole('group')).toBeNull())
    const userRowAfter = screen.getByRole('menuitem', { name: 'portrait' })
    expect(userRowAfter).toBe(userRowBefore)
    expect(userRowAfter).toHaveFocus()
  })
})
